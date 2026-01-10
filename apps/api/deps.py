import os
from typing import Annotated

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

load_dotenv()

# Initialize Clerk client
clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))


async def get_current_user(request: Request) -> dict:
    """
    Dependency that authenticates the request using Clerk.
    Returns the authenticated user's payload or raises 401.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # Build an httpx.Request for Clerk's authenticate_request
    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers),
    )

    # Authenticate the request
    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=["http://localhost:3000"],
        ),
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: {request_state.reason}",
        )

    return request_state.payload


# Type aliases for dependencies
CurrentUser = Annotated[dict, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
