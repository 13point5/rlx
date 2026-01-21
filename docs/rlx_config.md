# rlx.toml Configuration

The `rlx.toml` file defines run configurations for your project. Place this file in the root of your repository.

## Overview

When starting a new run, RLX reads the `rlx.toml` file from your repository to populate the config dropdown. Each configuration can specify:

- A single combined config file, OR
- Separate config files for inference, orchestrator, and trainer components
- Environment variables for the run

## File Location

```
your-repo/
├── rlx.toml          # <-- Place here (repository root)
├── configs/
│   ├── sft.toml
│   ├── rl_grpo.toml
│   └── ...
└── ...
```

## Format

Each top-level section in `rlx.toml` defines a named configuration:

```toml
[config-name]
description = "Optional description shown in dropdown"
config = "path/to/config.toml"           # Single combined config
inference = "path/to/inference.toml"     # OR separate configs
orchestrator = "path/to/orchestrator.toml"
trainer = "path/to/trainer.toml"
env_vars = { KEY = "value" }             # Optional environment variables
```

### Fields

| Field          | Type   | Description                                        |
| -------------- | ------ | -------------------------------------------------- |
| `description`  | string | Optional. Displayed in the config dropdown         |
| `config`       | string | Path to a single combined config file              |
| `inference`    | string | Path to inference config file                      |
| `orchestrator` | string | Path to orchestrator config file                   |
| `trainer`      | string | Path to trainer config file                        |
| `env_vars`     | table  | Optional. Environment variables as key-value pairs |

## Examples

### Simple SFT Configuration

```toml
[sft-baseline]
description = "Supervised fine-tuning baseline"
config = "configs/sft.toml"
```

### RL with Single Config

```toml
[rl-grpo]
description = "GRPO reinforcement learning"
config = "configs/rl_grpo.toml"
```

### RL with Separate Component Configs

```toml
[rl-distributed]
description = "Distributed RL training"
inference = "configs/inference/grpo.toml"
orchestrator = "configs/orchestrator/distributed.toml"
trainer = "configs/trainer/grpo.toml"
```

### With Environment Variables (Inline)

```toml
[sft-wandb]
description = "SFT with W&B logging"
config = "configs/sft.toml"
env_vars = { WANDB_PROJECT = "my-sft-project", WANDB_ENTITY = "my-team" }
```

### With Environment Variables (Expanded)

```toml
[rl-production]
description = "Production RL training"
config = "configs/rl_prod.toml"

[rl-production.env_vars]
WANDB_PROJECT = "rl-production"
WANDB_ENTITY = "my-team"
NUM_WORKERS = "16"
DEBUG = "false"
```

### Complete Example

```toml
# rlx.toml - RLX run configurations

[sft-baseline]
description = "Supervised fine-tuning baseline"
config = "configs/sft.toml"

[sft-large]
description = "SFT with larger batch size"
config = "configs/sft_large.toml"
env_vars = { BATCH_SIZE = "64" }

[rl-grpo]
description = "GRPO reinforcement learning"
config = "configs/rl_grpo.toml"

[rl-grpo-distributed]
description = "Distributed GRPO with separate configs"
inference = "configs/inference/grpo.toml"
orchestrator = "configs/orchestrator/multi_node.toml"
trainer = "configs/trainer/grpo.toml"

[rl-grpo-distributed.env_vars]
WANDB_PROJECT = "distributed-rl"
NUM_NODES = "4"
```

## Notes

- Config paths are relative to the repository root
- The branch selected in the UI determines which version of `rlx.toml` is read
- If `rlx.toml` is not found, the config dropdown will show instructions to create one
- At least one config path must be provided when starting a run (validated at run creation)
