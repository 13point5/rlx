"""Helpers for persisted run-level observability metadata and logs."""

from __future__ import annotations

from dataclasses import dataclass
import posixpath
import re
from typing import Any

from rlx_api.database import RunLogSource

RUN_LOG_SOURCE_LABELS: dict[str, str] = {
    RunLogSource.ORCHESTRATOR: "Orchestrator",
    RunLogSource.TRAINER: "Trainer",
    RunLogSource.INFERENCE: "Inference",
    RunLogSource.TEACHER_INFERENCE: "Teacher Inference",
}

RUN_LOG_SOURCE_ORDER = [
    RunLogSource.ORCHESTRATOR,
    RunLogSource.TRAINER,
    RunLogSource.INFERENCE,
    RunLogSource.TEACHER_INFERENCE,
]

WANDB_RUN_URL_PATTERN = re.compile(
    r"View run at (?P<url>https://wandb\.ai/[^\s]+/runs/(?P<run_id>[A-Za-z0-9]+))"
)


@dataclass(frozen=True)
class PrimeRLLogStreamSpec:
    """A surfaced Prime RL log stream mirrored into RLX storage."""

    source: str
    display_name: str
    remote_path: str | None


@dataclass(frozen=True)
class WandbRunMetadata:
    """Structured W&B run metadata extracted from process output."""

    run_id: str
    url: str


def get_run_log_source_label(source: str) -> str:
    """Return a stable UI label for a persisted log source."""
    return RUN_LOG_SOURCE_LABELS.get(source, source.replace("_", " ").title())


def is_surfaced_run_log_source(source: str) -> bool:
    """Return True when a source should appear in the run observability UI."""
    return source != RunLogSource.LAUNCHER


def order_run_log_sources(sources: list[str]) -> list[str]:
    """Sort sources using the intended UI order."""
    rank = {source: index for index, source in enumerate(RUN_LOG_SOURCE_ORDER)}
    return sorted(sources, key=lambda source: (rank.get(source, len(rank)), source))


def choose_default_run_log_source(sources: list[str]) -> str | None:
    """Pick the default log tab for a run."""
    if RunLogSource.ORCHESTRATOR in sources:
        return RunLogSource.ORCHESTRATOR

    ordered_sources = order_run_log_sources(sources)
    return ordered_sources[0] if ordered_sources else None


def build_prime_rl_log_stream_specs(output_dir: str) -> list[PrimeRLLogStreamSpec]:
    """Build the default surfaced log streams for a Prime RL launch."""
    log_dir = posixpath.join(output_dir, "logs")
    return [
        PrimeRLLogStreamSpec(
            source=RunLogSource.ORCHESTRATOR,
            display_name=get_run_log_source_label(RunLogSource.ORCHESTRATOR),
            remote_path=posixpath.join(log_dir, "orchestrator.stdout"),
        ),
        PrimeRLLogStreamSpec(
            source=RunLogSource.TRAINER,
            display_name=get_run_log_source_label(RunLogSource.TRAINER),
            remote_path=posixpath.join(log_dir, "trainer.stdout"),
        ),
        PrimeRLLogStreamSpec(
            source=RunLogSource.INFERENCE,
            display_name=get_run_log_source_label(RunLogSource.INFERENCE),
            remote_path=posixpath.join(log_dir, "inference.stdout"),
        ),
        PrimeRLLogStreamSpec(
            source=RunLogSource.TEACHER_INFERENCE,
            display_name=get_run_log_source_label(RunLogSource.TEACHER_INFERENCE),
            remote_path=posixpath.join(log_dir, "teacher_inference.stdout"),
        ),
    ]


def extract_wandb_run_metadata(text: str) -> WandbRunMetadata | None:
    """Extract the first surfaced W&B run URL from log text."""
    match = WANDB_RUN_URL_PATTERN.search(text)
    if not match:
        return None

    return WandbRunMetadata(
        run_id=match.group("run_id"),
        url=match.group("url"),
    )


def merge_wandb_run_metadata(
    monitoring: dict[str, Any] | None,
    *,
    source: str,
    metadata: WandbRunMetadata,
) -> dict[str, Any]:
    """Merge W&B run metadata into a copied monitoring payload."""
    merged: dict[str, Any] = dict(monitoring or {})
    wandb = dict(merged.get("wandb") or {})
    if source in wandb:
        return merged

    wandb[source] = {
        "run_id": metadata.run_id,
        "url": metadata.url,
    }
    merged["wandb"] = wandb
    return merged
