import unittest

from rlx_api.services.github import parse_rlx_config


class ParseRlxConfigTests(unittest.TestCase):
    def test_parses_valid_env_path(self) -> None:
        config = parse_rlx_config(
            """
[ascii-align]
description = "Train against the local ascii align env"
config = "configs/intellect-3/e1-control.toml"
env_path = "environments/ascii_align"

[ascii-align.env_vars]
OPENAI_API_KEY = "secret"
"""
        )

        self.assertTrue(config.found)
        self.assertEqual(len(config.configs), 1)
        self.assertEqual(config.configs[0].name, "ascii-align")
        self.assertEqual(config.configs[0].env_path, "environments/ascii_align")
        self.assertEqual(config.configs[0].env_vars, {"OPENAI_API_KEY": "secret"})

    def test_skips_entries_with_invalid_env_path(self) -> None:
        config = parse_rlx_config(
            """
[good]
config = "configs/good.toml"
env_path = "environments/ascii_align"

[bad]
config = "configs/bad.toml"
env_path = "../outside"
"""
        )

        self.assertEqual([entry.name for entry in config.configs], ["good"])


if __name__ == "__main__":
    unittest.main()
