import os
import urllib.parse
from dataclasses import asdict
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection, Project, get_db
from deps import CurrentUser, DbSession
from services import github as github_service

load_dotenv()

router = APIRouter(prefix="/api/github", tags=["github"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")


@router.get("/authorize")
async def authorize(user: CurrentUser, redirect_to: str):
    """Returns the GitHub OAuth authorization URL."""
    clerk_user_id = user.get("sub")

    # Encode user_id and redirect_to in state as "user_id:redirect_to"
    state = f"{clerk_user_id}:{redirect_to}"

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/api/github/callback",
        "scope": "repo read:user read:org",
        "state": state,
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
    # Decode state to get user_id and redirect_to
    redirect_to = "/home"  # default
    if state and ":" in state:
        parts = state.split(":", 1)
        clerk_user_id = parts[0]
        redirect_to = parts[1]
    else:
        clerk_user_id = state if state else None

    # Handle authorization denied
    if error:
        error_msg = error_description or error
        return RedirectResponse(
            url=f"{FRONTEND_URL}{redirect_to}?github=error&message={urllib.parse.quote(error_msg)}"
        )

    if not code or not clerk_user_id:
        return RedirectResponse(
            url=f"{FRONTEND_URL}{redirect_to}?github=error&message={urllib.parse.quote('Missing code or state')}"
        )

    try:
        # Exchange code for tokens
        token_data = await github_service.exchange_code_for_tokens(code)
        if not token_data:
            return RedirectResponse(
                url=f"{FRONTEND_URL}{redirect_to}?github=error&message={urllib.parse.quote('Failed to exchange code')}"
            )

        # Fetch GitHub user info
        github_user = await github_service.fetch_github_user(token_data.access_token)
        if not github_user:
            return RedirectResponse(
                url=f"{FRONTEND_URL}{redirect_to}?github=error&message={urllib.parse.quote('Failed to fetch user info')}"
            )

        # Upsert the GitHub connection
        result = await db.execute(
            select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.github_user_id = str(github_user.id)
            existing.github_username = github_user.username
            existing.access_token = token_data.access_token
            existing.refresh_token = token_data.refresh_token
            existing.token_expires_at = token_data.expires_at
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_connection = GitHubConnection(
                clerk_user_id=clerk_user_id,
                github_user_id=str(github_user.id),
                github_username=github_user.username,
                access_token=token_data.access_token,
                refresh_token=token_data.refresh_token,
                token_expires_at=token_data.expires_at,
            )
            db.add(new_connection)

        await db.commit()
        return RedirectResponse(url=f"{FRONTEND_URL}{redirect_to}?github=connected")

    except Exception as e:
        print(f"GitHub OAuth error: {e}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}{redirect_to}?github=error&message={urllib.parse.quote('Failed to connect to GitHub')}"
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


@router.get("/owners")
async def owners(user: CurrentUser, db: DbSession):
    """
    Fetch the authenticated user and their organizations.
    Returns a list of owners (user first, then orgs) that can be used in the owner dropdown.
    """
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
        # Fetch user info
        github_user = await github_service.fetch_github_user(access_token)
        if github_user is None:
            # Token invalid, try refresh
            new_token = await github_service.refresh_token(connection, db)
            if not new_token:
                await db.delete(connection)
                await db.commit()
                raise HTTPException(
                    status_code=401, detail="GitHub token expired. Please reconnect."
                )
            github_user = await github_service.fetch_github_user(new_token)
            if github_user is None:
                raise HTTPException(status_code=500, detail="Failed to fetch user info")
            access_token = new_token

        # Fetch orgs
        orgs = await github_service.fetch_user_orgs(access_token)
        if orgs is None:
            orgs = []

        # Return user first, then orgs
        owners_list = [asdict(github_user)] + [asdict(org) for org in orgs]

        return {"owners": owners_list}

    except Exception as e:
        if str(e) == "rate_limit":
            raise HTTPException(
                status_code=429, detail="GitHub API rate limit exceeded. Please try again later."
            )
        print(f"Error fetching owners: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch owners")


@router.get("/repos")
async def repos(
    user: CurrentUser,
    db: DbSession,
    page: int = 1,
    per_page: int = 25,
    search: str | None = None,
):
    """
    Fetch repositories the user has contributed to or owns.

    Query params:
    - page: Page number (default: 1)
    - per_page: Items per page (default: 25, max: 100)
    - search: Optional search query to filter by repo name
    """
    clerk_user_id = user.get("sub")

    # Validate pagination params
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 25
    if per_page > 100:
        per_page = 100

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

    # Get already imported repo IDs for this user
    existing_projects_result = await db.execute(
        select(Project.repo_id).where(Project.clerk_user_id == clerk_user_id)
    )
    imported_repo_ids = set(existing_projects_result.scalars().all())

    try:
        repos_response = await github_service.fetch_user_repos(
            access_token, page=page, per_page=per_page, search=search
        )

        if repos_response is None:
            # Token invalid, try refresh
            new_token = await github_service.refresh_token(connection, db)
            if not new_token:
                await db.delete(connection)
                await db.commit()
                raise HTTPException(
                    status_code=401, detail="GitHub token expired. Please reconnect."
                )

            repos_response = await github_service.fetch_user_repos(
                new_token, page=page, per_page=per_page, search=search
            )
            if repos_response is None:
                raise HTTPException(status_code=500, detail="Failed to fetch repositories")

        # Filter out already imported repos
        filtered_repos = [
            repo for repo in repos_response.repos
            if repo.id not in imported_repo_ids
        ]

        return {
            "repos": [asdict(repo) for repo in filtered_repos],
            "page": repos_response.page,
            "per_page": repos_response.per_page,
            "has_more": repos_response.has_more,
            "username": repos_response.username,
        }

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
