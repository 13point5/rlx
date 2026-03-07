# `rlx.toml` Configuration

`rlx.toml` lives in the root of the user's training repo and defines the named configs shown in the RLX run form.

## Current Launch Contract

Today, RLX uses the selected entry's single `config` file path to launch Prime RL.

That means the launcher ultimately runs:

```bash
uv run rl @ /workspace/repo/path/to/config.toml
```

So the currently supported shape for a runnable RLX config is:

```toml
[config-name]
description = "Optional description shown in the UI"
config = "path/to/config.toml"
```

## Example

From `/Users/13point5/projects/swe-grep-oss/rlx.toml`:

```toml
[grpo-f1]
description = "GRPO reinforcement learning with just the F1 reward"
config = "configs/grpo-f1.toml"
```

That resolves on the pod to:

```bash
uv run rl @ /workspace/repo/configs/grpo-f1.toml
```

The referenced config file in that repo is:

```toml
max_steps = 20
seq_len = 4096

[deployment]
num_train_gpus = 1
num_infer_gpus = 1
gpus_per_node = 2

[model]
name = "Qwen/Qwen3-4B-Instruct-2507"

[trainer.optim]
lr = 1e-5
weight_decay = 0.0

[trainer.model.lora]
rank = 8
alpha = 32

[orchestrator]
batch_size = 128
rollouts_per_example = 4

[orchestrator.sampling]
max_tokens = 1024

[[orchestrator.env]]
id = "swe-grep-oss"
name = "swe-grep-oss"
args = { dataset_name = "swe-bench-lite" }

[orchestrator.val]
interval = 10
num_examples = 16

[inference]
gpu_memory_utilization = 0.7

[inference.model]
tool_call_parser = "hermes"
max_model_len = 4096
```

## File Location

```text
your-repo/
├── rlx.toml
├── configs/
│   └── train.toml
└── ...
```

## Supported Fields

RLX currently parses these fields from each `rlx.toml` entry:

| Field | Description |
| --- | --- |
| `description` | Optional label shown in the UI |
| `config` | The single config file path used by the current launcher |
| `inference` | Parsed but not used by the current single-file launcher |
| `orchestrator` | Parsed but not used by the current single-file launcher |
| `trainer` | Parsed but not used by the current single-file launcher |
| `env_vars` | Parsed and forwarded into the final Prime RL launch job environment |

## Important Notes

- Config paths are relative to the repository root
- The selected branch determines which version of `rlx.toml` is read
- RLX validates that the referenced `config` file exists on the selected branch before it provisions a pod
- The current Prime RL launch path requires `config`, not just split `trainer` / `orchestrator` / `inference` fields
- If an entry defines `env_vars`, RLX passes them to job `8` when it launches `uv run rl @ ...`
- If `rlx.toml` is missing, the UI shows guidance and does not offer selectable configs
- If the selected entry does not expose a single `config` path, run creation should reject it
