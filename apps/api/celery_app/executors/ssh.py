"""SSH command executor using asyncssh."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator

import asyncssh

from celery_app.executors.base import CommandExecutor, CommandResult, CommandStatus

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
        timeout_seconds: int = 300,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        """Execute a command and return the result."""
        result = CommandResult(
            command=command,
            working_dir=working_dir,
            started_at=datetime.now(timezone.utc),
            status=CommandStatus.RUNNING,
        )

        try:
            conn = await self._get_connection()
            full_command = self._build_full_command(command, working_dir, env)

            logger.info(f"Executing command: {full_command[:100]}...")

            # Execute with timeout
            try:
                ssh_result = await asyncio.wait_for(
                    conn.run(full_command, check=False),
                    timeout=timeout_seconds,
                )

                result.stdout = ssh_result.stdout or ""
                result.stderr = ssh_result.stderr or ""
                result.exit_code = ssh_result.returncode
                result.status = (
                    CommandStatus.SUCCESS if ssh_result.returncode == 0 else CommandStatus.FAILED
                )

                if result.exit_code != 0:
                    result.error_type = "command_error"
                    result.error_message = f"Command exited with code {result.exit_code}"

                logger.info(f"Command completed with exit code {result.exit_code}")

            except asyncio.TimeoutError:
                result.status = CommandStatus.TIMEOUT
                result.error_message = f"Command timed out after {timeout_seconds} seconds"
                result.error_type = "timeout"
                logger.warning(f"Command timed out: {command[:50]}...")

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
