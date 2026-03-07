import unittest
from unittest.mock import patch

from rlx_api.celery_app.executors.ssh import SSHCommandExecutor
from rlx_api.celery_app.tasks.repo_tasks import (
    _maybe_wrap_with_wandb_setup,
    _resolve_custom_command_env,
)


class SSHCommandExecutorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.executor = SSHCommandExecutor(host="example.com")

    def test_build_full_command_exports_env_before_running_command(self) -> None:
        full_command = self.executor._build_full_command(
            "source $HOME/.local/bin/env && uv run rl @ /workspace/repo/train.toml",
            working_dir="/workspace/prime-rl",
            env={
                "WANDB_API_KEY": "wandb-secret",
                "RUN_NAME": "demo run",
            },
        )

        parts = full_command.split(" && ")
        self.assertEqual(parts[0], "export WANDB_API_KEY=wandb-secret")
        self.assertEqual(parts[1], "export RUN_NAME='demo run'")
        self.assertEqual(parts[2], "cd /workspace/prime-rl")
        self.assertEqual(
            " && ".join(parts[3:]),
            "source $HOME/.local/bin/env && uv run rl @ /workspace/repo/train.toml",
        )

    def test_build_full_command_redacts_env_values_for_logging(self) -> None:
        logged_command = self.executor._build_full_command(
            "echo ready",
            env={"WANDB_API_KEY": "wandb-secret"},
            redact_env=True,
        )

        self.assertIn("[REDACTED]", logged_command)
        self.assertNotIn("wandb-secret", logged_command)

    def test_build_full_command_rejects_invalid_env_var_names(self) -> None:
        with self.assertRaisesRegex(ValueError, "Invalid environment variable name"):
            self.executor._build_full_command(
                "echo ready",
                env={"WANDB-API-KEY": "wandb-secret"},
            )


class ResolveCustomCommandEnvTests(unittest.TestCase):
    @patch(
        "rlx_api.services.aws_secrets_manager.get_wandb_api_key_secret",
        return_value="wandb-secret",
    )
    def test_injects_wandb_key_for_flagged_launch_jobs(self, mocked_get_secret) -> None:
        env = _resolve_custom_command_env(
            {
                "env": {"FOO": "bar"},
                "inject_wandb_api_key": True,
            },
            clerk_user_id="user_123",
        )

        self.assertEqual(
            env,
            {
                "FOO": "bar",
                "WANDB_API_KEY": "wandb-secret",
            },
        )
        mocked_get_secret.assert_called_once_with("user_123")

    @patch(
        "rlx_api.services.aws_secrets_manager.get_wandb_api_key_secret",
        return_value="wandb-secret",
    )
    def test_injects_wandb_key_for_existing_prime_rl_launch_jobs(
        self,
        mocked_get_secret,
    ) -> None:
        env = _resolve_custom_command_env(
            {
                "command": "source $HOME/.local/bin/env && uv run rl @ /workspace/repo/train.toml",
                "working_dir": "/workspace/prime-rl",
            },
            clerk_user_id="user_123",
        )

        self.assertEqual(env, {"WANDB_API_KEY": "wandb-secret"})
        mocked_get_secret.assert_called_once_with("user_123")

    @patch(
        "rlx_api.services.aws_secrets_manager.get_wandb_api_key_secret",
        return_value=None,
    )
    def test_skips_wandb_injection_when_user_has_no_key(self, mocked_get_secret) -> None:
        env = _resolve_custom_command_env(
            {
                "env": {"FOO": "bar"},
                "inject_wandb_api_key": True,
            },
            clerk_user_id="user_123",
        )

        self.assertEqual(env, {"FOO": "bar"})
        mocked_get_secret.assert_called_once_with("user_123")

    def test_rejects_non_mapping_env_config(self) -> None:
        with self.assertRaisesRegex(ValueError, "env must be an object"):
            _resolve_custom_command_env(
                {"env": ["not", "a", "mapping"]},
                clerk_user_id="user_123",
            )


class PrimeRLWandbSetupTests(unittest.TestCase):
    def test_wraps_prime_rl_launch_with_wandb_setup(self) -> None:
        original_command = (
            "source $HOME/.local/bin/env && uv run rl @ /workspace/repo/configs/grpo-f1.toml"
        )
        wrapped_command = _maybe_wrap_with_wandb_setup(
            original_command,
            {
                "command": original_command,
                "working_dir": "/workspace/prime-rl",
                "inject_wandb_api_key": True,
            },
        )

        self.assertIn("grep -Eq", wrapped_command)
        self.assertIn("/workspace/repo/configs/grpo-f1.toml", wrapped_command)
        self.assertIn("wandb.login(key=key, relogin=True)", wrapped_command)
        self.assertTrue(wrapped_command.endswith(original_command))

    def test_leaves_non_launch_commands_unchanged(self) -> None:
        original_command = "echo ready"
        wrapped_command = _maybe_wrap_with_wandb_setup(
            original_command,
            {
                "command": original_command,
                "working_dir": "/workspace/repo",
            },
        )

        self.assertEqual(wrapped_command, original_command)
