from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query, status

from deps import CurrentUser
from services.prime_intellect import PrimeIntellectAPIError, fetch_gpu_availability

router = APIRouter(prefix="/api/compute", tags=["compute"])


@router.get("/availability/gpus")
async def get_gpu_availability(
    user: CurrentUser,  # noqa: ARG001 - required for authentication
    regions: List[str] | None = Query(None),
    gpu_count: int | None = Query(None, ge=1),
    gpu_type: str | None = Query(None),
    socket: str | None = Query(None),
    security: str | None = Query(None),
    data_center_id: str | None = Query(None),
    cloud_id: str | None = Query(None),
    disks: List[str] | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
) -> Dict[str, Any]:
    """Proxy GPU availability to Prime Intellect API."""

    params: Dict[str, Any] = {
        "regions": regions,
        "gpu_count": gpu_count,
        "gpu_type": gpu_type,
        "socket": socket,
        "security": security,
        "data_center_id": data_center_id,
        "cloud_id": cloud_id,
        "disks": disks,
        "page": page,
        "page_size": page_size,
    }

    try:
        return await fetch_gpu_availability(params)
    except PrimeIntellectAPIError as exc:  # pragma: no cover - simple pass-through
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
