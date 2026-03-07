import base64
import logging
import os
import posixpath
import re
import tomllib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from rlx_api.database import GitHubConnection

logger = logging.getLogger(__name__)


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


def _normalize_repo_relative_path(value: str) -> str:
    """Validate and normalize a repo-relative POSIX path from rlx.toml."""
    normalized = value.strip()
    if not normalized:
        raise ValueError("path cannot be empty")
    if normalized.startswith("/"):
        raise ValueError("path must be relative to the repository root")

    normalized = posixpath.normpath(normalized)
    if normalized in {".", ".."} or normalized.startswith("../"):
        raise ValueError("path must resolve inside the repository root")

    return normalized


class RlxConfigEntry(BaseModel):
    """A single validated config entry from rlx.toml."""

    model_config = ConfigDict(extra="ignore")

    name: str
    description: str | None = None
    config: str | None = None
    inference: str | None = None
    orchestrator: str | None = None
    trainer: str | None = None
    env_path: str | None = None
    env_vars: dict[str, str] | None = None

    @field_validator("config", "inference", "orchestrator", "trainer", "env_path")
    @classmethod
    def validate_repo_relative_paths(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_repo_relative_path(value)


class RlxConfigResponse(BaseModel):
    """Response for fetching rlx.toml configuration."""

    configs: list[RlxConfigEntry]
    found: bool  # Whether rlx.toml exists in the repo


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

    except Exception as e:
        logger.warning(f"Failed to refresh GitHub token: {e}")
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
    owner_username: str
    owner_type: str  # "User" or "Organization"
    owner_avatar_url: str


@dataclass
class ReposResponse:
    repos: list[RepoInfo]
    page: int
    per_page: int
    has_more: bool
    username: str | None = None
    total_count: int | None = None


@dataclass
class GitHubOwner:
    id: int
    username: str
    avatar_url: str
    type: str  # "User" or "Organization"


async def fetch_github_username(access_token: str) -> str | None:
    """Fetch the authenticated user's username."""
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
        return response.json().get("login")


async def fetch_github_user(access_token: str) -> GitHubOwner | None:
    """Fetch the authenticated user's info."""
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
        return GitHubOwner(
            id=data["id"],
            username=data["login"],
            avatar_url=data["avatar_url"],
            type="User",
        )


async def fetch_user_orgs(access_token: str) -> list[GitHubOwner] | None:
    """
    Fetch organizations the user has access to.
    Includes:
    1. Organizations the user is a member of
    2. Organizations whose repos the user has access to or contributed to
    """
    async with httpx.AsyncClient() as client:
        # Fetch organizations the user is a member of
        member_orgs_response = await client.get(
            "https://api.github.com/user/orgs",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if member_orgs_response.status_code == 401:
            return None

        member_orgs = member_orgs_response.json() if member_orgs_response.status_code == 200 else []

        # Extract unique organizations
        org_map = {}

        # Add member orgs first
        for org in member_orgs:
            org_map[org["login"].lower()] = GitHubOwner(
                id=org["id"],
                username=org["login"],
                avatar_url=org["avatar_url"],
                type="Organization",
            )

        # Fetch repos the user has access to (with pagination to get more orgs)
        page = 1
        max_pages = 3  # Limit to 300 repos to avoid rate limits

        while page <= max_pages:
            repos_response = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "affiliation": "owner,collaborator,organization_member",
                    "per_page": 100,
                    "page": page,
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            if repos_response.status_code != 200:
                break

            repos = repos_response.json()
            if not repos:
                break

            # Add orgs from repos
            for repo in repos:
                owner = repo.get("owner", {})
                owner_type = owner.get("type")
                owner_username = owner.get("login")

                # Only add if it's an organization and not already in the map
                if owner_type == "Organization" and owner_username:
                    username_lower = owner_username.lower()
                    if username_lower not in org_map:
                        org_map[username_lower] = GitHubOwner(
                            id=owner.get("id", 0),
                            username=owner_username,
                            avatar_url=owner.get("avatar_url", ""),
                            type="Organization",
                        )

            # If we got less than 100 repos, we're on the last page
            if len(repos) < 100:
                break

            page += 1

        # Also check repos the user has contributed to (authored commits/PRs)
        # Get the user's username first
        user = await fetch_github_user(access_token)
        if user:
            # Search for repos where the user has authored code
            contrib_response = await client.get(
                "https://api.github.com/search/repositories",
                params={
                    "q": f"author:{user.username}",
                    "per_page": 100,
                    "sort": "updated",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            if contrib_response.status_code == 200:
                search_data = contrib_response.json()
                contrib_repos = search_data.get("items", [])

                for repo in contrib_repos:
                    owner = repo.get("owner", {})
                    owner_type = owner.get("type")
                    owner_username = owner.get("login")

                    if owner_type == "Organization" and owner_username:
                        username_lower = owner_username.lower()
                        if username_lower not in org_map:
                            org_map[username_lower] = GitHubOwner(
                                id=owner.get("id", 0),
                                username=owner_username,
                                avatar_url=owner.get("avatar_url", ""),
                                type="Organization",
                            )

        # Return sorted list (by username)
        return sorted(org_map.values(), key=lambda o: o.username.lower())


async def fetch_user_repos(
    access_token: str,
    page: int = 1,
    per_page: int = 25,
    search: str | None = None,
) -> ReposResponse | None:
    """
    Fetch repositories the user has contributed to or owns.

    Args:
        access_token: GitHub OAuth token
        page: Page number (1-indexed)
        per_page: Number of repos per page (max 100)
        search: Optional search query to filter repos by name

    Returns:
        All repos where the user is owner or collaborator (contributed to).
        Excludes repos from orgs they're just a member of.
    """
    # Get authenticated user info
    user = await fetch_github_user(access_token)
    if not user:
        return None

    username = user.username

    async with httpx.AsyncClient() as client:
        if search and search.strip():
            # For search, fetch all contributed repos and filter client-side
            # This is simpler and more accurate than using GitHub search
            all_repos_response = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "affiliation": "owner,collaborator",
                    "per_page": 100,
                    "visibility": "all",
                    "sort": "updated",
                    "direction": "desc",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            if all_repos_response.status_code == 401:
                return None
            if all_repos_response.status_code == 403:
                raise Exception("rate_limit")
            if all_repos_response.status_code != 200:
                raise Exception("fetch_failed")

            all_repos = all_repos_response.json()

            # Filter by search term and sort by relevance
            search_lower = search.lower()

            # Separate name matches from description-only matches
            name_matches = [repo for repo in all_repos if search_lower in repo["name"].lower()]

            desc_only_matches = [
                repo
                for repo in all_repos
                if search_lower not in repo["name"].lower()
                and repo.get("description")
                and search_lower in repo["description"].lower()
            ]

            # Combine: name matches first, then description matches
            repos = name_matches + desc_only_matches
            total_count = len(repos)

            # Apply pagination to search results
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_repos = repos[start_idx:end_idx]

            return ReposResponse(
                repos=[
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
                        owner_username=repo["owner"]["login"],
                        owner_type=repo["owner"]["type"],
                        owner_avatar_url=repo["owner"]["avatar_url"],
                    )
                    for repo in paginated_repos
                ],
                page=page,
                per_page=per_page,
                has_more=total_count > end_idx,
                username=username,
                total_count=total_count,
            )
        else:
            # Fetch repos the user has actually contributed to or owns
            # Using owner,collaborator excludes repos from orgs they're just a member of
            response = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": per_page,
                    "page": page,
                    "affiliation": "owner,collaborator",  # Only repos they own or contribute to
                    "visibility": "all",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            if response.status_code == 401:
                return None
            if response.status_code == 403:
                raise Exception("rate_limit")
            if response.status_code != 200:
                raise Exception("fetch_failed")

            repos = response.json()

            # GitHub's pagination: if we got exactly per_page repos, there might be more
            return ReposResponse(
                repos=[
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
                        owner_username=repo["owner"]["login"],
                        owner_type=repo["owner"]["type"],
                        owner_avatar_url=repo["owner"]["avatar_url"],
                    )
                    for repo in repos
                ],
                page=page,
                per_page=per_page,
                has_more=len(repos) == per_page,  # If we got exactly per_page, there might be more
                username=username,
            )


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


@dataclass
class BranchesResponse:
    """Response for listing repository branches."""

    branches: list[str]
    page: int
    per_page: int
    has_more: bool


async def fetch_repo_branches(
    access_token: str,
    owner: str,
    repo: str,
    page: int = 1,
    per_page: int = 100,
) -> BranchesResponse:
    """
    Fetch branches for a repository from GitHub API.

    Args:
        access_token: GitHub OAuth token
        owner: Repository owner (user or org)
        repo: Repository name
        page: Page number (1-indexed)
        per_page: Number of branches per page (max 100)

    Returns:
        BranchesResponse with branch names and pagination info.

    Raises:
        GitHubTokenInvalidError: If the token is invalid (401)
        GitHubRepoNotFoundError: If the repo doesn't exist or user has no access (404)
        GitHubNoAccessError: If the user doesn't have access (403)
        GitHubRateLimitError: If rate limit is exceeded (429)
        GitHubAPIError: For other API errors
    """
    # Clamp per_page to GitHub's max
    per_page = min(per_page, 100)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/branches",
            params={
                "per_page": per_page,
                "page": page,
            },
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
            if "rate limit" in response.text.lower():
                raise GitHubRateLimitError("GitHub API rate limit exceeded")
            raise GitHubNoAccessError(f"No access to repository {owner}/{repo}")

        if response.status_code == 429:
            raise GitHubRateLimitError("GitHub API rate limit exceeded")

        if response.status_code != 200:
            raise GitHubAPIError(f"GitHub API error: {response.status_code}")

        data = response.json()

    branch_names = [branch["name"] for branch in data]

    return BranchesResponse(
        branches=branch_names,
        page=page,
        per_page=per_page,
        has_more=len(data) == per_page,
    )


async def repo_file_exists(
    access_token: str,
    owner: str,
    repo: str,
    path: str,
    branch: str = "main",
) -> bool:
    """
    Check whether a specific file exists in a repository branch.

    Returns False on 404 and raises the standard GitHub API exceptions
    for auth/access/rate-limit failures.
    """
    normalized_path = path.strip().lstrip("/")
    if not normalized_path:
        return False

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/{normalized_path}",
            params={"ref": branch},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

    if response.status_code == 401:
        raise GitHubTokenInvalidError("GitHub token is invalid or expired")

    if response.status_code == 404:
        return False

    if response.status_code == 403:
        if "rate limit" in response.text.lower():
            raise GitHubRateLimitError("GitHub API rate limit exceeded")
        raise GitHubNoAccessError(f"No access to repository {owner}/{repo}")

    if response.status_code == 429:
        raise GitHubRateLimitError("GitHub API rate limit exceeded")

    if response.status_code != 200:
        raise GitHubAPIError(f"GitHub API error: {response.status_code}")

    return True


def parse_rlx_config(content: str) -> RlxConfigResponse:
    """Parse and validate rlx.toml content."""
    toml_data = tomllib.loads(content)
    config_entries: list[RlxConfigEntry] = []

    for name, entry in toml_data.items():
        if not isinstance(entry, dict):
            continue

        try:
            config_entries.append(RlxConfigEntry(name=name, **entry))
        except ValidationError as exc:
            logger.warning("Skipping invalid rlx.toml entry '%s': %s", name, exc)

    return RlxConfigResponse(configs=config_entries, found=True)


async def fetch_rlx_config(
    access_token: str,
    owner: str,
    repo: str,
    branch: str = "main",
) -> RlxConfigResponse:
    """
    Fetch and parse rlx.toml from a repository.

    Uses GitHub Contents API to fetch the file, then parses TOML content.

    Args:
        access_token: GitHub OAuth token
        owner: Repository owner (user or org)
        repo: Repository name
        branch: Branch to fetch from (default: main)

    Returns:
        RlxConfigResponse with list of config entries and found status.

    Raises:
        GitHubTokenInvalidError: If the token is invalid (401)
        GitHubNoAccessError: If the user doesn't have access (403)
        GitHubRateLimitError: If rate limit is exceeded (429)
        GitHubAPIError: For other API errors
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/contents/rlx.toml",
            params={"ref": branch},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )

        if response.status_code == 401:
            raise GitHubTokenInvalidError("GitHub token is invalid or expired")

        if response.status_code == 404:
            # File not found - this is expected, return empty response
            return RlxConfigResponse(configs=[], found=False)

        if response.status_code == 403:
            if "rate limit" in response.text.lower():
                raise GitHubRateLimitError("GitHub API rate limit exceeded")
            raise GitHubNoAccessError(f"No access to repository {owner}/{repo}")

        if response.status_code == 429:
            raise GitHubRateLimitError("GitHub API rate limit exceeded")

        if response.status_code != 200:
            raise GitHubAPIError(f"GitHub API error: {response.status_code}")

        data = response.json()

    # Decode base64 content
    content_base64 = data.get("content", "")
    try:
        content_bytes = base64.b64decode(content_base64)
        return parse_rlx_config(content_bytes.decode("utf-8"))
    except Exception as e:
        logger.warning(f"Failed to parse rlx.toml: {e}")
        # Return found=True but empty configs if parsing fails
        return RlxConfigResponse(configs=[], found=True)
