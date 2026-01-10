# API Development Guidelines

This document describes development patterns and tools for the Python FastAPI backend.

## Overall Project Structure

This is a monorepo with the following structure:

```
rlx/
├── apps/
│   ├── api/              # Python FastAPI backend (this directory)
│   └── web/              # Next.js frontend
└── docs/                 # Documentation
```

### API Directory Structure

```
apps/api/
├── alembic/              # Database migrations
│   ├── versions/         # Migration files
│   └── env.py            # Migration environment config
├── routers/              # API route handlers
│   ├── __init__.py
│   ├── github.py         # GitHub OAuth routes
│   ├── health.py         # Health check routes
│   └── projects.py       # Project CRUD routes
├── services/             # Business logic and external API integrations
│   ├── __init__.py
│   └── github.py         # GitHub API service
├── database.py           # SQLAlchemy models and DB connection
├── deps.py               # FastAPI dependencies (auth, db session)
├── main.py               # FastAPI app entry point
├── alembic.ini           # Alembic configuration
└── pyproject.toml        # Python dependencies (managed by uv)
```

### Key Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app initialization, middleware, router registration |
| `database.py` | SQLAlchemy models (tables) and database connection |
| `deps.py` | Reusable dependencies: `CurrentUser` (auth), `DbSession` (database) |
| `routers/*.py` | API endpoints grouped by feature |
| `services/*.py` | Business logic, external API calls |

## Database Migrations with Alembic

This project uses [Alembic](https://alembic.sqlalchemy.org/) for database schema migrations with Neon PostgreSQL.

### Running Migrations

Always use `uv run` to ensure you're using the correct virtual environment:

```bash
cd apps/api

# Apply all pending migrations
uv run alembic upgrade head

# Check current migration status
uv run alembic current

# View migration history
uv run alembic history
```

### Creating New Migrations

After modifying SQLAlchemy models in `database.py`:

```bash
cd apps/api

# Auto-generate migration from model changes
uv run alembic revision --autogenerate -m "description of changes"

# Review the generated migration file in alembic/versions/
# Edit if needed (remove unwanted changes, adjust operations)

# Apply the migration
uv run alembic upgrade head
```

### Rolling Back Migrations

```bash
# Rollback one migration
uv run alembic downgrade -1

# Rollback to a specific revision
uv run alembic downgrade <revision_id>

# Rollback all migrations
uv run alembic downgrade base
```

### Best Practices

1. **Always review auto-generated migrations** - Alembic may detect false positives (e.g., TEXT vs String type differences)
2. **Keep migrations focused** - One logical change per migration
3. **Test migrations locally** before applying to production
4. **Never modify applied migrations** - Create new migrations to fix issues
5. **Use descriptive messages** - `"add projects table"` not `"update"`

### Configuration

- `alembic.ini` - Main configuration file
- `alembic/env.py` - Environment setup (loads DATABASE_URL from .env)
- `alembic/versions/` - Migration files

The configuration automatically:
- Loads `DATABASE_URL` from environment variables
- Converts async PostgreSQL URLs to sync for migrations
- Handles Neon-specific connection parameters

## Running the API

```bash
cd apps/api
uv run python main.py
```

Or with uvicorn directly:

```bash
cd apps/api
uv run uvicorn main:app --reload --port 8000
```

## Adding Dependencies

```bash
cd apps/api
uv add <package-name>
```

## Adding New API Routes

### 1. Create a Router File

Create a new file in `routers/` (e.g., `routers/runs.py`):

```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from deps import CurrentUser, DbSession

router = APIRouter(prefix="/api/runs", tags=["runs"])


# Pydantic models for request/response
class CreateRunRequest(BaseModel):
    name: str
    config_path: str


class RunResponse(BaseModel):
    id: int
    name: str
    status: str

    class Config:
        from_attributes = True


# Routes
@router.post("", status_code=status.HTTP_201_CREATED, response_model=RunResponse)
async def create_run(body: CreateRunRequest, user: CurrentUser, db: DbSession):
    """Create a new training run."""
    clerk_user_id = user.get("sub")
    # Implementation here...
    pass


@router.get("", response_model=list[RunResponse])
async def list_runs(user: CurrentUser, db: DbSession):
    """List all runs for the authenticated user."""
    clerk_user_id = user.get("sub")
    # Implementation here...
    pass
```

### 2. Register the Router

Add the router to `main.py`:

```python
from routers import github, health, projects, runs  # Add new import

# In the router registration section:
app.include_router(runs.router)
```

### Key Patterns

- **Use `CurrentUser` dependency** for authentication - extracts `clerk_user_id` from JWT
- **Use `DbSession` dependency** for database access - provides async SQLAlchemy session
- **Define Pydantic models** in the same router file for request/response validation
- **Use appropriate HTTP status codes** - 201 for creation, 404 for not found, etc.
- **Group related endpoints** in the same router file

## Adding New Services

Services contain business logic and external API integrations. Create a new file in `services/` (e.g., `services/training.py`):

```python
from dataclasses import dataclass

import httpx


# Data classes for structured responses
@dataclass
class TrainingJob:
    id: str
    status: str
    progress: float


# Custom exceptions
class TrainingAPIError(Exception):
    """Base exception for training API errors."""
    pass


class TrainingJobNotFoundError(TrainingAPIError):
    """Raised when training job is not found."""
    pass


# Service functions
async def start_training_job(config: dict) -> TrainingJob:
    """Start a new training job on the compute provider."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.example.com/jobs",
            json=config,
            headers={"Authorization": "Bearer ..."},
        )

        if response.status_code != 201:
            raise TrainingAPIError(f"Failed to start job: {response.status_code}")

        data = response.json()

    return TrainingJob(
        id=data["id"],
        status=data["status"],
        progress=0.0,
    )


async def get_training_job(job_id: str) -> TrainingJob:
    """Get training job status."""
    # Implementation...
    pass
```

### Service Patterns

- **Use `dataclass` for structured data** - cleaner than dicts
- **Define custom exceptions** - allows routers to handle errors appropriately
- **Use `httpx.AsyncClient`** for external API calls (async-compatible)
- **Keep services stateless** - no instance variables, pure functions

## Adding New Database Models

### 1. Define the Model

Add the model to `database.py`:

```python
class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    project_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")
    config_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
```

### 2. Create Migration

```bash
cd apps/api
uv run alembic revision --autogenerate -m "add runs table"
```

### 3. Review and Apply Migration

```bash
# Review the generated file in alembic/versions/
# Then apply:
uv run alembic upgrade head
```

### Model Patterns

- **Always include `clerk_user_id`** for user-scoped data
- **Add `created_at` and `updated_at`** timestamps
- **Use `index=True`** on frequently queried columns
- **Define `UniqueConstraint`** for composite uniqueness

## Authentication

All authenticated endpoints use the `CurrentUser` dependency from `deps.py`:

```python
from deps import CurrentUser

@router.get("/protected")
async def protected_route(user: CurrentUser):
    clerk_user_id = user.get("sub")  # Get user ID from JWT
    # user dict contains full JWT payload
```

The `CurrentUser` dependency:
- Validates the JWT token from the `Authorization` header
- Uses Clerk for authentication
- Raises 401 if not authenticated

## Error Handling

Use FastAPI's `HTTPException` with appropriate status codes:

```python
from fastapi import HTTPException, status

# 400 - Bad Request
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Invalid input format",
)

# 401 - Unauthorized
raise HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
)

# 403 - Forbidden
raise HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="You don't have access to this resource",
)

# 404 - Not Found
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="Resource not found",
)

# 409 - Conflict
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Resource already exists",
)

# 429 - Too Many Requests
raise HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Rate limit exceeded",
)
```
