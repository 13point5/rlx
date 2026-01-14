import os
from typing import Any, Dict

import httpx


BASE_URL = "https://api.primeintellect.ai"
DEFAULT_TIMEOUT = 10.0


class PrimeIntellectAPIError(Exception):
    """Raised when the Prime Intellect API returns an error."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


async def _get_headers() -> Dict[str, str]:
    api_key = os.getenv("PRIME_INTELLECT_API_KEY")
    if not api_key:
        raise PrimeIntellectAPIError(500, "Prime Intellect API key not configured")
    return {"Authorization": f"Bearer {api_key}"}


async def fetch_gpu_availability(params: Dict[str, Any]) -> Dict[str, Any]:
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/availability/gpus"

    query_params = {k: v for k, v in params.items() if v is not None}

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers, params=query_params)

    return _handle_response(response)


async def fetch_gpu_summary() -> Dict[str, Any]:
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/availability/gpu-summary"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers)

    return _handle_response(response)


async def create_pod(pod_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new pod instance.

    Args:
        pod_config: Dictionary containing pod configuration
            Required fields:
            - pod.name: Name of the pod
            - pod.cloudId: Cloud ID from availability data
            - pod.gpuType: GPU type (e.g., "H100_80GB")
            - pod.socket: Socket type (e.g., "PCIe")
            - pod.gpuCount: Number of GPUs
            - pod.image: Image to use (e.g., "ubuntu_22_cuda_12")
            - pod.dataCenterId: Data center ID
            - pod.country: Country code
            - pod.security: "secure_cloud" or "community_cloud"
            - provider.type: Provider type (e.g., "hyperstack")

    Returns:
        Dictionary with pod creation response
    """
    headers = await _get_headers()
    headers["Content-Type"] = "application/json"
    url = f"{BASE_URL}/api/v1/pods/"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=pod_config)

    return _handle_response(response)


async def get_pod_status(pod_id: str) -> Dict[str, Any]:
    """
    Get the status of a pod.

    Args:
        pod_id: The ID of the pod to check

    Returns:
        Dictionary with pod status information including:
        - status: PROVISIONING, PENDING, ACTIVE, STOPPED, ERROR, DELETING, TERMINATED
        - sshConnection: SSH connection string (when active)
        - ip: IP address (when active)
        - costPerHr: Cost per hour
        - installationProgress: Installation progress (0-100)
        - installationFailure: Error message if failed
    """
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/pods/status/"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers, params={"pod_ids": pod_id})

    data = _handle_response(response)
    # The status endpoint returns a single object for one pod_id
    return data


async def get_pod(pod_id: str) -> Dict[str, Any]:
    """Get detailed information about a specific pod."""
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/pods/{pod_id}"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers)

    return _handle_response(response)


async def delete_pod(pod_id: str) -> Dict[str, Any]:
    """Delete a pod."""
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/pods/{pod_id}"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.delete(url, headers=headers)

    return _handle_response(response)


def _handle_response(response: httpx.Response) -> Dict[str, Any]:
    if response.status_code >= 400:
        try:
            data = response.json()
            error_message = data.get("error", {}).get("message") or data.get("message")
        except ValueError:
            error_message = None

        message = error_message or response.text or "Prime Intellect API error"
        raise PrimeIntellectAPIError(response.status_code, message)

    try:
        return response.json()
    except ValueError:
        raise PrimeIntellectAPIError(
            500, "Invalid JSON response from Prime Intellect API"
        )
