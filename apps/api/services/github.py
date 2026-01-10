import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

from database import GitHubConnection


# Custom exceptions for GitHub API errors
class GitHubAPIError(Exception):
    """Base exception for GitHub API errors."""

    pass


class GitHubTokenInvalidError(GitHubAPIError):
    """Raised when the GitHub token is invalid (401)."""

    pass


class GitHubRepoNotFoundError(GitHubAPIError):
    """Raised when the repository is not found or user has no access (404)."""

    pass


class GitHubNoAccessError(GitHubAPIError):
    """Raised when the user doesn't have access to the repository (403)."""

    pass


class GitHubRateLimitError(GitHubAPIError):
    """Raised when GitHub API rate limit is exceeded (429 or 403 with rate limit)."""

    pass


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


def parse_github_repo_url(url: str) -> tuple[str, str] | None:
    """
    Parse various GitHub URL formats and extract owner and repo name.

    Supports:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - git@github.com:owner/repo.git
    - owner/repo

    Returns (owner, repo) tuple or None if invalid.
    """
    url = url.strip()

    # Pattern for HTTPS URLs: https://github.com/owner/repo or https://github.com/owner/repo.git
    https_pattern = r"^https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$"
    match = re.match(https_pattern, url)
    if match:
        return (match.group(1), match.group(2))

    # Pattern for SSH URLs: git@github.com:owner/repo.git
    ssh_pattern = r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$"
    match = re.match(ssh_pattern, url)
    if match:
        return (match.group(1), match.group(2))

    # Pattern for short format: owner/repo
    short_pattern = r"^([a-zA-Z0-9_-]+)/([a-zA-Z0-9._-]+)$"
    match = re.match(short_pattern, url)
    if match:
        return (match.group(1), match.group(2))

    return None


@dataclass
class RepoDetails:
    """Detailed repository information for project creation."""

    id: int
    name: str
    owner: str
    owner_type: str  # "User" or "Organization"
    html_url: str
    private: bool
    description: str | None


async def fetch_repo_info(access_token: str, owner: str, repo: str) -> RepoDetails:
    """
    Fetch repository information from GitHub API.

    Raises:
        GitHubTokenInvalidError: If the token is invalid (401)
        GitHubRepoNotFoundError: If the repo doesn't exist or user has no access (404)
        GitHubNoAccessError: If the user doesn't have access (403)
        GitHubRateLimitError: If rate limit is exceeded (429)
        GitHubAPIError: For other API errors
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

        if response.status_code == 401:
            raise GitHubTokenInvalidError("GitHub token is invalid or expired")

        if response.status_code == 404:
            raise GitHubRepoNotFoundError(f"Repository {owner}/{repo} not found or no access")

        if response.status_code == 403:
            # Check if it's a rate limit error
            if "rate limit" in response.text.lower():
                raise GitHubRateLimitError("GitHub API rate limit exceeded")
            raise GitHubNoAccessError(f"No access to repository {owner}/{repo}")

        if response.status_code == 429:
            raise GitHubRateLimitError("GitHub API rate limit exceeded")

        if response.status_code != 200:
            raise GitHubAPIError(f"GitHub API error: {response.status_code}")

        data = response.json()

    return RepoDetails(
        id=data["id"],
        name=data["name"],
        owner=data["owner"]["login"],
        owner_type=data["owner"]["type"],  # "User" or "Organization"
        html_url=data["html_url"],
        private=data["private"],
        description=data.get("description"),
    )
