import base64
import unittest

from rlx_api.celery_app.tasks.repo_tasks import _parse_run_log_fetch_output
from rlx_api.database import RunLogSource
from rlx_api.run_observability import (
    build_prime_rl_log_stream_specs,
    choose_default_run_log_source,
    extract_wandb_run_metadata,
    is_surfaced_run_log_source,
    merge_wandb_run_metadata,
    order_run_log_sources,
)


class RunObservabilityHelperTests(unittest.TestCase):
    def test_build_prime_rl_log_stream_specs_uses_output_dir_logs(self) -> None:
        specs = build_prime_rl_log_stream_specs("/workspace/prime-rl/outputs")

        self.assertEqual(
            [spec.source for spec in specs],
            [
                RunLogSource.ORCHESTRATOR,
                RunLogSource.TRAINER,
                RunLogSource.INFERENCE,
                RunLogSource.TEACHER_INFERENCE,
            ],
        )
        self.assertEqual(specs[0].remote_path, "/workspace/prime-rl/outputs/logs/orchestrator.stdout")
        self.assertEqual(specs[1].remote_path, "/workspace/prime-rl/outputs/logs/trainer.stdout")

    def test_choose_default_run_log_source_prefers_orchestrator(self) -> None:
        default_source = choose_default_run_log_source(
            [
                RunLogSource.TRAINER,
                RunLogSource.ORCHESTRATOR,
            ]
        )

        self.assertEqual(default_source, RunLogSource.ORCHESTRATOR)

    def test_launcher_is_not_a_surfaced_observability_source(self) -> None:
        self.assertFalse(is_surfaced_run_log_source(RunLogSource.LAUNCHER))
        self.assertTrue(is_surfaced_run_log_source(RunLogSource.ORCHESTRATOR))

    def test_order_run_log_sources_uses_ui_priority(self) -> None:
        ordered_sources = order_run_log_sources(
            [
                RunLogSource.LAUNCHER,
                RunLogSource.TEACHER_INFERENCE,
                RunLogSource.ORCHESTRATOR,
                RunLogSource.TRAINER,
            ]
        )

        self.assertEqual(
            ordered_sources,
            [
                RunLogSource.ORCHESTRATOR,
                RunLogSource.TRAINER,
                RunLogSource.TEACHER_INFERENCE,
                RunLogSource.LAUNCHER,
            ],
        )

    def test_extract_wandb_run_metadata(self) -> None:
        text = (
            "wandb: View project at https://wandb.ai/acme/demo\n"
            "wandb: View run at https://wandb.ai/acme/demo/runs/53g8xhrk\n"
        )

        metadata = extract_wandb_run_metadata(text)

        self.assertIsNotNone(metadata)
        assert metadata is not None
        self.assertEqual(metadata.run_id, "53g8xhrk")
        self.assertEqual(metadata.url, "https://wandb.ai/acme/demo/runs/53g8xhrk")

    def test_merge_wandb_run_metadata_is_one_time_per_source(self) -> None:
        first_metadata = extract_wandb_run_metadata(
            "wandb: View run at https://wandb.ai/acme/demo/runs/53g8xhrk"
        )
        second_metadata = extract_wandb_run_metadata(
            "wandb: View run at https://wandb.ai/acme/demo/runs/override"
        )

        assert first_metadata is not None
        assert second_metadata is not None

        monitoring = merge_wandb_run_metadata(
            None,
            source=RunLogSource.TRAINER,
            metadata=first_metadata,
        )
        # Second merge for the same source should keep the original.
        merged_again = merge_wandb_run_metadata(
            monitoring,
            source=RunLogSource.TRAINER,
            metadata=second_metadata,
        )

        self.assertEqual(monitoring, merged_again)


class RunLogFetchPayloadTests(unittest.TestCase):
    def test_parse_run_log_fetch_output_with_new_content(self) -> None:
        encoded = base64.b64encode(b"step 1\nstep 2\n").decode("ascii")
        end_offset, content = _parse_run_log_fetch_output(f"12\n{encoded}")

        self.assertEqual(end_offset, 12)
        self.assertEqual(content, "step 1\nstep 2\n")

    def test_parse_run_log_fetch_output_without_new_content(self) -> None:
        end_offset, content = _parse_run_log_fetch_output("0\n")

        self.assertEqual(end_offset, 0)
        self.assertEqual(content, "")

    def test_parse_run_log_fetch_output_returns_none_for_missing_file(self) -> None:
        self.assertIsNone(_parse_run_log_fetch_output(""))


if __name__ == "__main__":
    unittest.main()
