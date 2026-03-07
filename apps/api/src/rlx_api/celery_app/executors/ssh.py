"""SSH command executor using asyncssh."""

import asyncio
import inspect
import logging
from contextlib import suppress
from datetime import datetime, timezone
from typing import AsyncGenerator

import asyncssh

from rlx_api.celery_app.executors.base import (
    CommandExecutor,
    CommandResult,
    CommandStatus,
    OutputSnapshotCallback,
)

logger = logging.getLogger(__name__)


class SSHCommandExecutor(CommandExecutor):
    """Execute commands on remote host via SSH using asyncssh."""

    def __init__(
        self,
        host: str,
        port: int = 22,
        username: str = "root",
        private_key: str | None = None,
        private_key_path: str | None = None,
        known_hosts: str | None = None,
    ):
        """
        Initialize SSH executor.

        Args:
            host: Remote host to connect to
            port: SSH port (default: 22)
            username: SSH username (default: root)
            private_key: Private key contents as string
            private_key_path: Path to private key file
            known_hosts: Known hosts file path or None to disable checking
        """
        self.host = host
        self.port = port
        self.username = username
        self.private_key = private_key
        self.private_key_path = private_key_path
        self.known_hosts = known_hosts
        self._connection: asyncssh.SSHClientConnection | None = None

    @classmethod
    def from_connection_string(
        cls,
        connection_string: str,
        private_key: str,
    ) -> "SSHCommandExecutor":
        """
        Create executor from SSH connection string.

        Supports formats:
            - "ssh user@host"
            - "ssh user@host -p port"
            - "user@host"
            - "user@host -p port"

        Args:
            connection_string: SSH connection string from Prime Intellect
            private_key: Private key contents as string
        """
        # Remove leading "ssh " if present
        conn = connection_string.strip()
        if conn.startswith("ssh "):
            conn = conn[4:]

        # Parse port if present (format: "user@host -p port")
        port = 22
        if " -p " in conn:
            parts = conn.split(" -p ")
            conn = parts[0]
            try:
                port = int(parts[1].strip().split()[0])
            except (ValueError, IndexError):
                logger.warning(f"Failed to parse port from: {connection_string}, using 22")

        # Parse user@host
        if "@" not in conn:
            raise ValueError(f"Invalid connection string, missing @: {connection_string}")

        username, host = conn.split("@", 1)

        logger.info(f"Parsed connection string: {username}@{host}:{port}")

        return cls(
            host=host,
            port=port,
            username=username,
            private_key=private_key,
        )

    async def _get_connection(self) -> asyncssh.SSHClientConnection:
        """Get or create SSH connection."""
        if self._connection is None or self._connection.is_closed():
            connect_args: dict = {
                "host": self.host,
                "port": self.port,
                "username": self.username,
                "known_hosts": None,  # Disable host key checking for cloud pods
            }

            if self.private_key:
                # Load key from string
                logger.debug(f"Loading private key (length: {len(self.private_key)} chars)")
                try:
                    imported_key = asyncssh.import_private_key(self.private_key)
                    logger.debug(f"Imported key type: {imported_key.get_algorithm()}")
                    connect_args["client_keys"] = [imported_key]
                except Exception as e:
                    logger.error(f"Failed to import private key: {e}")
                    raise
            elif self.private_key_path:
                connect_args["client_keys"] = [self.private_key_path]

            logger.info(f"Connecting to {self.username}@{self.host}:{self.port}")
            self._connection = await asyncssh.connect(**connect_args)
            logger.info(f"Connected to {self.host}")

        return self._connection

    def _build_full_command(
        self,
        command: str,
        working_dir: str | None = None,
        env: dict[str, str] | None = None,
    ) -> str:
        """Build the full command with working directory and environment."""
        full_command = command

        if working_dir:
            full_command = f"cd {working_dir} && {command}"

        if env:
            env_prefix = " ".join(f'{k}="{v}"' for k, v in env.items())
            full_command = f"{env_prefix} {full_command}"

        return full_command

    async def execute(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int | None = 300,  # None = no timeout
        env: dict[str, str] | None = None,
        on_snapshot: OutputSnapshotCallback | None = None,
        snapshot_interval_seconds: float = 5.0,
    ) -> CommandResult:
        """Execute a command and return the result."""
        result = CommandResult(
            command=command,
            working_dir=working_dir,
            started_at=datetime.now(timezone.utc),
            status=CommandStatus.RUNNING,
        )
        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        snapshot_lock = asyncio.Lock()
        last_flushed_sizes = (0, 0)

        async def flush_snapshot(*, force: bool = False) -> None:
            nonlocal last_flushed_sizes

            if on_snapshot is None:
                return

            async with snapshot_lock:
                stdout_snapshot = "".join(stdout_parts)
                stderr_snapshot = "".join(stderr_parts)
                snapshot_sizes = (len(stdout_snapshot), len(stderr_snapshot))

                if not force and snapshot_sizes == last_flushed_sizes:
                    return

                try:
                    maybe_awaitable = on_snapshot(stdout_snapshot, stderr_snapshot)
                    if inspect.isawaitable(maybe_awaitable):
                        await maybe_awaitable
                except Exception:
                    logger.warning(
                        "Failed to persist live command output for %s",
                        command[:100],
                        exc_info=True,
                    )
                    return

                last_flushed_sizes = snapshot_sizes

        async def read_stream(stream, parts: list[str]) -> None:
            while True:
                chunk = await stream.read(4096)
                if not chunk:
                    return
                parts.append(chunk)

        async def periodic_flush() -> None:
            if on_snapshot is None:
                return

            while True:
                await asyncio.sleep(snapshot_interval_seconds)
                await flush_snapshot()

        flush_task: asyncio.Task[None] | None = None
        stdout_task: asyncio.Task[None] | None = None
        stderr_task: asyncio.Task[None] | None = None

        try:
            conn = await self._get_connection()
            full_command = self._build_full_command(command, working_dir, env)

            logger.info(f"Executing command: {full_command[:100]}...")

            async with conn.create_process(full_command) as process:
                stdout_task = asyncio.create_task(read_stream(process.stdout, stdout_parts))
                stderr_task = asyncio.create_task(read_stream(process.stderr, stderr_parts))
                if on_snapshot is not None:
                    flush_task = asyncio.create_task(periodic_flush())

                try:
                    ssh_result = await process.wait(check=False, timeout=timeout_seconds)
                except TimeoutError:
                    process.terminate()
                    with suppress(Exception):
                        await asyncio.wait_for(process.wait_closed(), timeout=5)
                    if process.exit_status is None:
                        process.kill()
                        with suppress(Exception):
                            await process.wait_closed()

                    result.status = CommandStatus.TIMEOUT
                    result.error_message = f"Command timed out after {timeout_seconds} seconds"
                    result.error_type = "timeout"
                    logger.warning(f"Command timed out: {command[:50]}...")
                else:
                    result.exit_code = ssh_result.returncode
                    result.status = (
                        CommandStatus.SUCCESS if ssh_result.returncode == 0 else CommandStatus.FAILED
                    )

                    if result.exit_code != 0:
                        result.error_type = "command_error"
                        result.error_message = f"Command exited with code {result.exit_code}"

                    logger.info(f"Command completed with exit code {result.exit_code}")

        except asyncssh.Error as e:
            result.status = CommandStatus.FAILED
            result.error_message = str(e)
            result.error_type = "ssh_error"
            logger.exception(f"SSH error executing command: {e}")

        except Exception as e:
            result.status = CommandStatus.FAILED
            result.error_message = str(e)
            result.error_type = "unknown"
            logger.exception(f"Error executing command: {e}")

        finally:
            if stdout_task is not None or stderr_task is not None:
                await asyncio.gather(
                    stdout_task or asyncio.sleep(0),
                    stderr_task or asyncio.sleep(0),
                    return_exceptions=True,
                )

            result.stdout = "".join(stdout_parts)
            result.stderr = "".join(stderr_parts)

            if flush_task is not None:
                flush_task.cancel()
                with suppress(asyncio.CancelledError):
                    await flush_task

            await flush_snapshot(force=True)

            result.completed_at = datetime.now(timezone.utc)
            if result.started_at and result.completed_at:
                result.duration_ms = int(
                    (result.completed_at - result.started_at).total_seconds() * 1000
                )

        return result

    async def execute_streaming(
        self,
        command: str,
        *,
        working_dir: str | None = None,
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Execute a command and yield output as it streams."""
        conn = await self._get_connection()
        full_command = self._build_full_command(command, working_dir, env)

        logger.info(f"Starting streaming command: {full_command[:100]}...")

        async with conn.create_process(full_command) as process:
            async for line in process.stdout:
                yield line

    async def is_available(self) -> bool:
        """Check if SSH connection is available."""
        try:
            conn = await self._get_connection()
            result = await conn.run("echo ok", check=True)
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"SSH connection check failed: {e}")
            return False

    async def close(self):
        """Close the SSH connection."""
        if self._connection:
            self._connection.close()
            await self._connection.wait_closed()
            self._connection = None
            logger.info(f"Closed SSH connection to {self.host}")
