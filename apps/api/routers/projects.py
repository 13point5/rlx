from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, computed_field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import GitHubConnection, Project
from deps import CurrentUser, DbSession
from services import github as github_service
from services.github import (
    GitHubAPIError,
    GitHubNoAccessError,
    GitHubRateLimitError,
    GitHubRepoNotFoundError,
    GitHubTokenInvalidError,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


# =============================================================================
# Pydantic Models
# =============================================================================


class CreateProjectRequest(BaseModel):
    repo_url: str


class ProjectResponse(BaseModel):
    id: int
    repo_id: int
    repo_name: str
    repo_owner: str
    repo_owner_type: str
    repo_url: str
    active_runs: int = 0
    created_at: datetime
    updated_at: datetime | None = None

    @computed_field
    @property
    def repo_full_name(self) -> str:
        """Derived field: repo_owner/repo_name"""
        return f"{self.repo_owner}/{self.repo_name}"

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]


# =============================================================================
# Helper Functions
# =============================================================================


async def get_github_connection(clerk_user_id: str, db: DbSession) -> GitHubConnection:
    """Get the user's GitHub connection or raise 401."""
    result = await db.execute(
        select(GitHubConnection).where(GitHubConnection.clerk_user_id == clerk_user_id)
    )
    connection = result.scalar_one_or_none()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub not connected. Please connect your GitHub account first.",
        )

    return connection


async def get_valid_github_token(connection: GitHubConnection, db: DbSession) -> str:
    """Get a valid GitHub access token or raise 401."""
    access_token = await github_service.get_valid_token(connection, db)

    if not access_token:
        await db.delete(connection)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token expired. Please reconnect your GitHub account.",
        )

    return access_token


def project_to_response(project: Project) -> ProjectResponse:
    """Convert a Project model to ProjectResponse."""
    return ProjectResponse(
        id=project.id,
        repo_id=project.repo_id,
        repo_name=project.repo_name,
        repo_owner=project.repo_owner,
        repo_owner_type=project.repo_owner_type,
        repo_url=project.repo_url,
        active_runs=0,  # TODO: Calculate from runs table when implemented
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


# =============================================================================
# Routes
# =============================================================================


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
async def create_project(body: CreateProjectRequest, user: CurrentUser, db: DbSession):
    """
    Create a new project from a GitHub repository URL.

    Validates that:
    - The URL is a valid GitHub repository URL
    - The user has connected their GitHub account
    - The user has access to the repository
    - The project doesn't already exist
    """
    clerk_user_id = user.get("sub")

    # Parse the GitHub URL
    parsed = github_service.parse_github_repo_url(body.repo_url)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GitHub repository URL. Supported formats: https://github.com/owner/repo, git@github.com:owner/repo.git, or owner/repo",
        )

    owner, repo = parsed

    # Get GitHub connection and valid token
    connection = await get_github_connection(clerk_user_id, db)
    access_token = await get_valid_github_token(connection, db)

    # Fetch repo info from GitHub to verify access and get details
    try:
        repo_info = await github_service.fetch_repo_info(access_token, owner, repo)
    except GitHubTokenInvalidError:
        # Token became invalid, try to refresh
        new_token = await github_service.refresh_token(connection, db)
        if not new_token:
            await db.delete(connection)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="GitHub token expired. Please reconnect your GitHub account.",
            )
        # Retry with new token
        try:
            repo_info = await github_service.fetch_repo_info(new_token, owner, repo)
        except GitHubAPIError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )
    except GitHubRepoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository {owner}/{repo} not found or you don't have access to it.",
        )
    except GitHubNoAccessError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to repository {owner}/{repo}.",
        )
    except GitHubRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="GitHub API rate limit exceeded. Please try again later.",
        )
    except GitHubAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    # Check if project already exists
    existing = await db.execute(
        select(Project).where(
            Project.clerk_user_id == clerk_user_id, Project.repo_id == repo_info.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project for repository {repo_info.owner}/{repo_info.name} already exists.",
        )

    # Create the project
    project = Project(
        clerk_user_id=clerk_user_id,
        repo_id=repo_info.id,
        repo_name=repo_info.name,
        repo_owner=repo_info.owner,
        repo_owner_type=repo_info.owner_type,
        repo_url=repo_info.html_url,
    )

    try:
        db.add(project)
        await db.commit()
        await db.refresh(project)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project for repository {repo_info.owner}/{repo_info.name} already exists.",
        )

    return project_to_response(project)


@router.get("", response_model=ProjectListResponse)
async def list_projects(user: CurrentUser, db: DbSession):
    """List all projects for the authenticated user."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Project)
        .where(Project.clerk_user_id == clerk_user_id)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()

    return ProjectListResponse(projects=[project_to_response(p) for p in projects])


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, user: CurrentUser, db: DbSession):
    """Get a specific project by ID."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.clerk_user_id == clerk_user_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    return project_to_response(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, user: CurrentUser, db: DbSession):
    """Delete a project by ID."""
    clerk_user_id = user.get("sub")

    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.clerk_user_id == clerk_user_id)
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    await db.delete(project)
    await db.commit()

    return None
