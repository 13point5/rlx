"""Background worker for GPU provisioning and repo cloning."""

import asyncio
import os
from typing import Any, Dict

import httpx
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Run, async_session
from services.prime_intellect import (
    PrimeIntellectAPIError,
    create_pod,
    get_pod_status,
)

load_dotenv()


class ProvisioningWorker:
    """Worker that handles GPU provisioning and repo cloning in the background."""

    def __init__(self):
        self.running = False
        self.task = None

    async def start(self):
        """Start the background worker."""
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._worker_loop())

    async def stop(self):
        """Stop the background worker."""
        self.running = False
        if self.task:
            await self.task

    async def _worker_loop(self):
        """Main worker loop that polls for pending runs and processes them."""
        while self.running:
            try:
                await self._process_pending_runs()
                await self._check_provisioning_runs()
            except Exception as e:
                print(f"Error in provisioning worker: {e}")

            # Poll every 10 seconds
            await asyncio.sleep(10)

    async def _process_pending_runs(self):
        """Find runs in 'pending' status and start provisioning."""
        if not async_session:
            return

        async with async_session() as db:
            result = await db.execute(select(Run).where(Run.status == "pending"))
            pending_runs = result.scalars().all()

            for run in pending_runs:
                try:
                    await self._start_provisioning(run, db)
                except Exception as e:
                    print(f"Error starting provisioning for run {run.id}: {e}")
                    run.status = "failed"
                    run.error_message = str(e)
                    await db.commit()

    async def _start_provisioning(self, run: Run, db: AsyncSession):
        """Start provisioning a GPU pod for the run."""
        # Update status to provisioning
        run.status = "provisioning"
        await db.commit()

        # Create pod configuration
        pod_config = {
            "pod": {
                "name": f"{run.name} (Run #{run.id})",
                "cloudId": run.cloud_id,
                "gpuType": run.gpu_type,
                "gpuCount": run.gpu_count,
                "image": "ubuntu_22_cuda_12",  # Default image
                "security": "secure_cloud",
            },
            "provider": {"type": run.provider},
        }

        # Add optional fields if present
        if run.data_center_id:
            pod_config["pod"]["dataCenterId"] = run.data_center_id

        try:
            # Create the pod via Prime Intellect API
            response = await create_pod(pod_config)

            # Extract pod ID from response
            # Response structure: {"id": "pod_id", ...}
            pod_id = response.get("id")

            if not pod_id:
                raise Exception("No pod ID in response")

            # Update run with pod ID
            run.pod_id = pod_id
            await db.commit()

        except PrimeIntellectAPIError as e:
            run.status = "failed"
            run.error_message = f"Failed to provision pod: {e.message}"
            await db.commit()
            raise

    async def _check_provisioning_runs(self):
        """Check status of runs that are provisioning."""
        if not async_session:
            return

        async with async_session() as db:
            result = await db.execute(select(Run).where(Run.status == "provisioning"))
            provisioning_runs = result.scalars().all()

            for run in provisioning_runs:
                if not run.pod_id:
                    continue

                try:
                    await self._update_run_status(run, db)
                except Exception as e:
                    print(f"Error checking status for run {run.id}: {e}")

    async def _update_run_status(self, run: Run, db: AsyncSession):
        """Update the status of a provisioning run."""
        try:
            status_data = await get_pod_status(run.pod_id)

            # Update run with pod status
            pod_status = status_data.get("status")
            run.ssh_connection = status_data.get("sshConnection")
            run.ip_address = status_data.get("ip")
            run.cost_per_hr = str(status_data.get("costPerHr", ""))
            run.installation_progress = status_data.get("installationProgress", 0)

            # Check if provisioning failed
            if pod_status == "ERROR":
                run.status = "failed"
                run.error_message = status_data.get("installationFailure") or "Pod provisioning failed"
                await db.commit()
                return

            # Check if pod is active
            if pod_status == "ACTIVE" and run.installation_progress == 100:
                run.status = "active"
                await db.commit()

                # Trigger repo cloning
                await self._clone_repo(run, db)

            await db.commit()

        except PrimeIntellectAPIError as e:
            print(f"Error fetching pod status for run {run.id}: {e}")

    async def _clone_repo(self, run: Run, db: AsyncSession):
        """Clone the GitHub repository to the provisioned instance."""
        # Import here to avoid circular dependency
        from database import GitHubConnection, Project
        from services.github import get_valid_token

        try:
            # Update clone status
            run.clone_status = "cloning"
            await db.commit()

            # Get project info
            project_result = await db.execute(select(Project).where(Project.id == run.project_id))
            project = project_result.scalar_one_or_none()

            if not project:
                raise Exception("Project not found")

            # Get GitHub connection for access token
            gh_result = await db.execute(
                select(GitHubConnection).where(GitHubConnection.clerk_user_id == run.clerk_user_id)
            )
            gh_connection = gh_result.scalar_one_or_none()

            if not gh_connection:
                raise Exception("GitHub connection not found")

            # Get valid access token
            access_token = await get_valid_token(gh_connection, db)

            if not access_token:
                raise Exception("Failed to get valid GitHub access token")

            # Construct clone command using HTTPS with token
            repo_url = f"https://{access_token}@github.com/{project.repo_full_name}.git"

            # Execute clone command via SSH
            clone_command = f"cd /root && git clone {repo_url} repo"

            # Use SSH to execute the command
            ssh_result = await self._execute_ssh_command(run.ssh_connection, clone_command)

            if ssh_result:
                run.clone_status = "cloned"
            else:
                run.clone_status = "failed"
                run.clone_error = "Failed to clone repository"

            await db.commit()

        except Exception as e:
            print(f"Error cloning repo for run {run.id}: {e}")
            run.clone_status = "failed"
            run.clone_error = str(e)
            await db.commit()

    async def _execute_ssh_command(self, ssh_connection: str, command: str) -> bool:
        """
        Execute a command via SSH.

        Args:
            ssh_connection: SSH connection string like "root@135.23.125.123 -p 22"
            command: Command to execute

        Returns:
            True if successful, False otherwise
        """
        try:
            # Parse SSH connection string
            # Format: "root@135.23.125.123 -p 22"
            parts = ssh_connection.split()
            if len(parts) < 1:
                return False

            user_host = parts[0]  # root@135.23.125.123
            port = "22"

            # Extract port if specified
            if "-p" in parts:
                port_idx = parts.index("-p")
                if port_idx + 1 < len(parts):
                    port = parts[port_idx + 1]

            # Build SSH command
            # Note: In production, you'd want to use paramiko or asyncssh library
            # For now, we'll use subprocess which requires proper SSH key setup
            ssh_cmd = f"ssh -o StrictHostKeyChecking=no -p {port} {user_host} '{command}'"

            # Execute command
            proc = await asyncio.create_subprocess_shell(
                ssh_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await proc.communicate()

            return proc.returncode == 0

        except Exception as e:
            print(f"SSH command execution failed: {e}")
            return False


# Global worker instance
_worker: ProvisioningWorker | None = None


async def start_worker():
    """Start the global provisioning worker."""
    global _worker
    if _worker is None:
        _worker = ProvisioningWorker()
    await _worker.start()


async def stop_worker():
    """Stop the global provisioning worker."""
    global _worker
    if _worker:
        await _worker.stop()
