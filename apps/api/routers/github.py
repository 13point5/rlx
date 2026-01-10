import os
import urllib.parse
from dataclasses import asdict
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection, get_db
from deps import CurrentUser, DbSession
from services import github as github_service

load_dotenv()

router = APIRouter(prefix="/api/github", tags=["github"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")


@router.get("/authorize")
async def authorize(user: CurrentUser):
    """Returns the GitHub OAuth authorization URL."""
    clerk_user_id = user.get("sub")

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/api/github/callback",
        "scope": "repo read:user",
        "state": clerk_user_id,
    }

    auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return {"authorization_url": auth_url}


@router.get("/callback")
async def callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Handles the GitHub OAuth callback."""
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
        # Exchange code for tokens
        token_data = await github_service.exchange_code_for_tokens(code)
        if not token_data:
            return RedirectResponse(
                url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote('Failed to exchange code')}"
            )

        # Fetch GitHub user info
        github_user = await github_service.fetch_github_user(token_data.access_token)
        if not github_user:
            return RedirectResponse(
                url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote('Failed to fetch user info')}"
            )

        # Upsert the GitHub connection
        result = await db.execute(
            select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.github_user_id = github_user.id
            existing.github_username = github_user.username
            existing.access_token = token_data.access_token
            existing.refresh_token = token_data.refresh_token
            existing.token_expires_at = token_data.expires_at
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_connection = GitHubConnection(
                clerk_user_id=clerk_user_id,
                github_user_id=github_user.id,
                github_username=github_user.username,
                access_token=token_data.access_token,
                refresh_token=token_data.refresh_token,
                token_expires_at=token_data.expires_at,
            )
            db.add(new_connection)

        await db.commit()
        return RedirectResponse(url=f"{FRONTEND_URL}/home?github=connected")

    except Exception as e:
        print(f"GitHub OAuth error: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/home?github=error&message={urllib.parse.quote('Failed to connect to GitHub')}"
        )


@router.get("/status")
async def status(user: CurrentUser, db: DbSession):
    """Check if the current user has a GitHub connection."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        return {"connected": False}

    return {"connected": True, "username": connection.github_username}


@router.get("/repos")
async def repos(user: CurrentUser, db: DbSession):
    """Fetch the user's top 5 most recently updated repositories."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(status_code=404, detail="GitHub not connected")

    access_token = await github_service.get_valid_token(connection, db)
    if not access_token:
        await db.delete(connection)
        await db.commit()
        raise HTTPException(status_code=401, detail="GitHub token expired. Please reconnect.")

    try:
        repos_list = await github_service.fetch_user_repos(access_token)

        if repos_list is None:
            # Token invalid, try refresh
            new_token = await github_service.refresh_token(connection, db)
            if not new_token:
                await db.delete(connection)
                await db.commit()
                raise HTTPException(
                    status_code=401, detail="GitHub token expired. Please reconnect."
                )

            repos_list = await github_service.fetch_user_repos(new_token)
            if repos_list is None:
                raise HTTPException(status_code=500, detail="Failed to fetch repositories")

        return {"repos": [asdict(repo) for repo in repos_list]}

    except Exception as e:
        if str(e) == "rate_limit":
            raise HTTPException(
                status_code=429, detail="GitHub API rate limit exceeded. Please try again later."
            )
        print(f"Error fetching repos: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch repositories")


@router.post("/disconnect")
async def disconnect(user: CurrentUser, db: DbSession):
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
