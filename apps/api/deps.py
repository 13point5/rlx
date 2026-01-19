import os
from typing import Annotated

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection, get_db
from sqlalchemy import select

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


# =============================================================================
# GitHub Connection Helpers
# =============================================================================


async def get_github_connection(clerk_user_id: str, db: AsyncSession) -> GitHubConnection:
    """Get the user's GitHub connection or raise 404."""
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="GitHub not connected")

    return connection


async def get_valid_github_token(connection: GitHubConnection, db: AsyncSession) -> str:
    """
    Get a valid GitHub access token or raise 401.

    If the token is expired and cannot be refreshed, the connection is deleted.
    """
    # Import here to avoid circular imports
    from services import github as github_service

    access_token = await github_service.get_valid_token(connection, db)

    if not access_token:
        await db.delete(connection)
        await db.commit()
        raise HTTPException(status_code=401, detail="GitHub token expired. Please reconnect.")

    return access_token
