import os
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection, get_db

load_dotenv()

app = FastAPI(title="RLX API")

# Configuration
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Clerk client
clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))


async def get_current_user(request: Request) -> dict:
    """
    Dependency that authenticates the request using Clerk.
    Returns the authenticated user's payload or raises 401.
    """
    # Get the Authorization header
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


# Type alias for the dependency
CurrentUser = Annotated[dict, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


@app.get("/")
async def root():
    """Public health check endpoint."""
    return {"status": "ok", "message": "RLX API is running"}


@app.get("/api/secret")
async def get_secret(user: CurrentUser):
    """
    Protected endpoint that returns a secret.
    Only accessible to authenticated users.
    """
    user_id = user.get("sub")
    return {
        "secret": "🔐 This is a super secret message!",
        "user_id": user_id,
        "message": f"Hello authenticated user {user_id}!",
    }


# =============================================================================
# GitHub OAuth Endpoints
# =============================================================================


@app.get("/api/github/authorize")
async def github_authorize(user: CurrentUser):
    """
    Returns the GitHub OAuth authorization URL.
    Uses the clerk_user_id as the state parameter for the callback.
    """
    clerk_user_id = user.get("sub")

    # Use the backend URL for the callback - it will redirect to frontend after processing
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{backend_url}/api/github/callback",
        "scope": "repo read:user",
        "state": clerk_user_id,
    }

    auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return {"authorization_url": auth_url}


@app.get("/api/github/callback")
async def github_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handles the GitHub OAuth callback.
    Exchanges the code for tokens, fetches user info, and stores in DB.
    """
    # Handle authorization denied
    if error:
        error_msg = error_description or error
        return RedirectResponse(
            url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote(error_msg)}"
        )

    if not code or not state:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote('Missing code or state')}"
        )

    clerk_user_id = state

    try:
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_response.json()

        if "error" in token_data:
            error_msg = token_data.get("error_description", token_data.get("error"))
            return RedirectResponse(
                url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote(error_msg)}"
            )

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")

        # Calculate token expiration
        token_expires_at = None
        if expires_in:
            token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        # Fetch GitHub user info
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            github_user = user_response.json()

        github_user_id = str(github_user.get("id"))
        github_username = github_user.get("login")

        # Upsert the GitHub connection
        result = await db.execute(
            select(GitHubConnection).where(
                GitHubConnection.clerk_user_id == clerk_user_id
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.github_user_id = github_user_id
            existing.github_username = github_username
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_connection = GitHubConnection(
                clerk_user_id=clerk_user_id,
                github_user_id=github_user_id,
                github_username=github_username,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at,
            )
            db.add(new_connection)

        await db.commit()

        return RedirectResponse(url=f"{FRONTEND_URL}/home?github=connected")

    except Exception as e:
        print(f"GitHub OAuth error: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote('Failed to connect to GitHub')}"
        )


async def refresh_github_token(connection: GitHubConnection, db: AsyncSession) -> str | None:
    """Refresh the GitHub access token using the refresh token."""
    if not connection.refresh_token:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": connection.refresh_token,
                },
                headers={"Accept": "application/json"},
            )
            token_data = response.json()

        if "error" in token_data:
            return None

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")

        # Update the connection
        connection.access_token = access_token
        if refresh_token:
            connection.refresh_token = refresh_token
        if expires_in:
            connection.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        connection.updated_at = datetime.now(timezone.utc)

        await db.commit()
        return access_token

    except Exception:
        return None


async def get_valid_access_token(connection: GitHubConnection, db: AsyncSession) -> str | None:
    """Get a valid access token, refreshing if necessary."""
    # Check if token is expired
    if connection.token_expires_at and connection.token_expires_at < datetime.now(timezone.utc):
        # Try to refresh
        new_token = await refresh_github_token(connection, db)
        if new_token:
            return new_token
        # Refresh failed, return None to indicate reconnection needed
        return None

    return connection.access_token


@app.get("/api/github/status")
async def github_status(user: CurrentUser, db: DbSession):
    """Check if the current user has a GitHub connection."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        return {"connected": False}

    return {
        "connected": True,
        "username": connection.github_username,
    }


@app.get("/api/github/repos")
async def github_repos(user: CurrentUser, db: DbSession):
    """Fetch the user's top 5 most recently updated GitHub repositories."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="GitHub not connected")

    access_token = await get_valid_access_token(connection, db)
    if not access_token:
        # Token expired and refresh failed, delete connection
        await db.delete(connection)
        await db.commit()
        raise HTTPException(status_code=401, detail="GitHub token expired. Please reconnect.")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": 5,
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            if response.status_code == 401:
                # Token invalid, try refresh
                new_token = await refresh_github_token(connection, db)
                if not new_token:
                    await db.delete(connection)
                    await db.commit()
                    raise HTTPException(status_code=401, detail="GitHub token expired. Please reconnect.")

                # Retry with new token
                response = await client.get(
                    "https://api.github.com/user/repos",
                    params={
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": 5,
                    },
                    headers={
                        "Authorization": f"Bearer {new_token}",
                        "Accept": "application/vnd.github+json",
                    },
                )

            if response.status_code == 403:
                raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded. Please try again later.")

            response.raise_for_status()
            repos = response.json()

        return {
            "repos": [
                {
                    "id": repo["id"],
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo["description"],
                    "html_url": repo["html_url"],
                    "private": repo["private"],
                    "language": repo["language"],
                    "stargazers_count": repo["stargazers_count"],
                    "updated_at": repo["updated_at"],
                }
                for repo in repos
            ]
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch repositories")
    except Exception as e:
        print(f"Error fetching repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch repositories")


@app.post("/api/github/disconnect")
async def github_disconnect(user: CurrentUser, db: DbSession):
    """Disconnect GitHub from the current user's account."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if connection:
        await db.delete(connection)
        await db.commit()

    return {"success": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
