"""Base command executor and result types."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, AsyncGenerator


class CommandStatus(StrEnum):
    """Status of command execution."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


@dataclass
class CommandResult:
    """Result of a command execution."""

    # Core fields
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None
    status: CommandStatus = CommandStatus.PENDING

    # Timing
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None

    # Error context
    error_message: str | None = None
    error_type: str | None = None  # "timeout", "ssh_error", "command_error", etc.

    # Metadata
    command: str = ""
    working_dir: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def success(self) -> bool:
        """Check if command executed successfully."""
        return self.status == CommandStatus.SUCCESS and self.exit_code == 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "error_message": self.error_message,
            "error_type": self.error_type,
            "command": self.command,
            "working_dir": self.working_dir,
            "extra": self.extra,
        }


class CommandExecutor(ABC):
    """Base class for command executors."""

    @abstractmethod
    async def execute(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        """
        Execute a command and return the result.

        Args:
            command: The command to execute
            working_dir: Working directory for command execution
            timeout_seconds: Maximum time to wait for command completion
            env: Environment variables to set for the command

        Returns:
            CommandResult with stdout, stderr, exit_code, and status
        """
        pass

    @abstractmethod
    async def execute_streaming(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Execute a command and yield output as it streams.

        Args:
            command: The command to execute
            working_dir: Working directory for command execution
            timeout_seconds: Maximum time to wait for command completion
            env: Environment variables to set for the command

        Yields:
            Lines of output as they are produced
        """
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        """
        Check if the executor is available (e.g., SSH connection works).

        Returns:
            True if executor is ready to execute commands
        """
        pass
