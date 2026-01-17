import os
from typing import Any, Dict, List, Optional

import httpx


BASE_URL = "https://api.primeintellect.ai"
DEFAULT_TIMEOUT = 10.0
POD_CREATE_TIMEOUT = 30.0
DEFAULT_IMAGE = "ubuntu_22_cuda_12"


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


async def create_pod(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/pods/"

    async with httpx.AsyncClient(timeout=POD_CREATE_TIMEOUT) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
        except httpx.ReadTimeout as exc:
            raise PrimeIntellectAPIError(
                504, "Prime Intellect create pod timed out"
            ) from exc

    return _handle_response(response)


async def upload_prime_ssh_key(
    public_key: str, name: Optional[str] = None
) -> Dict[str, Any]:
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/ssh_keys"
    payload = {"publicKey": public_key}
    if name:
        payload["name"] = name

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=payload)

    return _handle_response(response)


async def fetch_pod_status(pod_ids: List[str]) -> Dict[str, Any]:
    headers = await _get_headers()
    url = f"{BASE_URL}/api/v1/pods/status"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers, params={"pod_ids": pod_ids})

    return _handle_response(response)


async def delete_pod(pod_id: str) -> Dict[str, Any]:
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
