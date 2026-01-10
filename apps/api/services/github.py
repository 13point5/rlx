import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection

load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")


@dataclass
class TokenData:
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None


@dataclass
class GitHubUser:
    id: str
    username: str


async def exchange_code_for_tokens(code: str) -> TokenData | None:
    """Exchange an OAuth code for access and refresh tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        data = response.json()

    if "error" in data:
        return None

    expires_at = None
    if expires_in := data.get("expires_in"):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    return TokenData(
        access_token=data.get("access_token"),
        refresh_token=data.get("refresh_token"),
        expires_at=expires_at,
    )


async def fetch_github_user(access_token: str) -> GitHubUser | None:
    """Fetch the authenticated user's info from GitHub."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

        if response.status_code != 200:
            return None

        data = response.json()

    return GitHubUser(
        id=str(data.get("id")),
        username=data.get("login"),
    )


async def refresh_token(connection: GitHubConnection, db: AsyncSession) -> str | None:
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
            data = response.json()

        if "error" in data:
            return None

        connection.access_token = data.get("access_token")
        if new_refresh := data.get("refresh_token"):
            connection.refresh_token = new_refresh
        if expires_in := data.get("expires_in"):
            connection.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        connection.updated_at = datetime.now(timezone.utc)

        await db.commit()
        return connection.access_token

    except Exception:
        return None


async def get_valid_token(connection: GitHubConnection, db: AsyncSession) -> str | None:
    """Get a valid access token, refreshing if necessary."""
    if connection.token_expires_at and connection.token_expires_at < datetime.now(timezone.utc):
        return await refresh_token(connection, db)
    return connection.access_token


@dataclass
class RepoInfo:
    id: int
    name: str
    full_name: str
    description: str | None
    html_url: str
    private: bool
    language: str | None
    stargazers_count: int
    updated_at: str


async def fetch_user_repos(access_token: str, limit: int = 5) -> list[RepoInfo] | None:
    """Fetch the user's most recently updated repositories."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            params={
                "sort": "updated",
                "direction": "desc",
                "per_page": limit,
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

        if response.status_code == 401:
            return None  # Token invalid
        if response.status_code == 403:
            raise Exception("rate_limit")
        if response.status_code != 200:
            raise Exception("fetch_failed")

        repos = response.json()

    return [
        RepoInfo(
            id=repo["id"],
            name=repo["name"],
            full_name=repo["full_name"],
            description=repo["description"],
            html_url=repo["html_url"],
            private=repo["private"],
            language=repo["language"],
            stargazers_count=repo["stargazers_count"],
            updated_at=repo["updated_at"],
        )
        for repo in repos
    ]
