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


async def fetch_gpu_availability(params: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("PRIME_INTELLECT_API_KEY")
    if not api_key:
        raise PrimeIntellectAPIError(500, "Prime Intellect API key not configured")

    url = f"{BASE_URL}/api/v1/availability/gpus"
    headers = {"Authorization": f"Bearer {api_key}"}

    query_params = {k: v for k, v in params.items() if v is not None}

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.get(url, headers=headers, params=query_params)

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
