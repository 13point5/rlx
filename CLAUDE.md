# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RLX is a monorepo containing a Next.js frontend and FastAPI backend for managing reinforcement learning experiments with GitHub integration.

**Stack:**
- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Clerk authentication
- Backend: Python 3.13, FastAPI, SQLAlchemy (async), PostgreSQL, Alembic migrations
- Monorepo structure with separate `apps/web` and `apps/api`

## Development Commands

### Frontend (`apps/web`)

```bash
# Install dependencies
pnpm install

# Run development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start

# Lint
pnpm lint
```

### Backend (`apps/api`)

```bash
# Navigate to API directory
cd apps/api

# Install dependencies (using uv package manager)
uv sync

# Run development server (http://localhost:8000, with auto-reload)
uv run uvicorn main:app --reload --port 8000

# Create a new database migration (after modifying database.py models)
uv run alembic revision --autogenerate -m "description of changes"

# Apply migrations to database
uv run alembic upgrade head

# Rollback last migration
uv run alembic downgrade -1

# View current migration status
uv run alembic current

# View migration history
uv run alembic history
```

## Architecture

### Authentication Flow

1. **Clerk** handles user authentication on frontend (`@clerk/nextjs`)
2. Frontend gets session token via `await getToken()` in Server Actions
3. Token sent to backend API in `Authorization: Bearer <token>` header
4. Backend validates token using Clerk SDK (`deps.py:get_current_user`)
5. Use `CurrentUser` dependency in routes to get authenticated user payload

### Database Architecture

**Location:** `apps/api/database.py`

- **SQLAlchemy async engine** with asyncpg driver
- **Models:** `GitHubConnection`, `Project` (extend `Base` from `DeclarativeBase`)
- **Session management:** `get_db()` dependency provides `AsyncSession`
- **Migrations:** Alembic manages schema changes in `alembic/versions/`

**Database URL handling:**
- Loaded from `DATABASE_URL` environment variable
- Automatically converts `sslmode=require` to `ssl=require` for asyncpg compatibility
- Strips unsupported `channel_binding` parameter

### API Structure

**Entry point:** `apps/api/main.py`
- FastAPI app with CORS middleware (allows `http://localhost:3000`)
- Routers registered: `health`, `github`, `projects`

**Routers** (`apps/api/routers/`):
- Group related endpoints by feature
- Use dependencies from `deps.py`: `CurrentUser`, `DbSession`
- Example: `github.py` handles OAuth flow and GitHub API interactions

**Services** (`apps/api/services/`):
- Business logic and external API integrations
- Example: `github.py` contains GitHub API client logic

**Dependencies** (`apps/api/deps.py`):
- `CurrentUser`: Annotated type for authenticated Clerk user
- `DbSession`: Annotated type for async database session
- `get_current_user()`: Validates Clerk session token

### Frontend Architecture

**App Router structure** (`apps/web/app/`):
- `layout.tsx`: Root layout with ClerkProvider, dark mode, Geist fonts
- `page.tsx`: Landing/home page
- `home/`: Authenticated home view
- `projects/`: Project management pages
- `sign-in/`, `sign-up/`: Authentication pages (Clerk)
- `actions/`: Server Actions for API calls

**Middleware** (`apps/web/proxy.ts`):
- Clerk middleware protects routes (public routes: `/`, `/sign-in`, `/sign-up`)
- All other routes require authentication

**Components structure** (`apps/web/components/`):
- `ui/`: Primitive shadcn/ui components (Button, Card, Dialog, etc.)
- Root-level: Feature/composed components (ProjectCard, AppHeader, etc.)
- Follow shadcn/ui patterns (see `apps/web/AGENTS.md` for details)

**Server Actions pattern** (`apps/web/app/actions/`):
- Use `"use server"` directive
- Get Clerk token: `const token = await getToken()`
- Call backend API with Authorization header
- Return `{ success: boolean, data?, error? }`

### GitHub Integration

1. OAuth flow initiated from frontend (`components/github-connect.tsx`)
2. Backend (`routers/github.py`) exchanges code for access token
3. Token stored in `github_connections` table with `clerk_user_id`
4. Service layer (`services/github.py`) provides GitHub API wrapper
5. Projects linked to GitHub repos via `repo_id` (permanent identifier)

## Key Patterns

### Adding a New API Endpoint

1. Define route in appropriate router file (`apps/api/routers/`)
2. Use type annotations: `CurrentUser`, `DbSession` dependencies
3. Implement business logic in service layer if complex
4. Return Pydantic models or dicts (FastAPI auto-converts to JSON)

Example:
```python
from deps import CurrentUser, DbSession

@router.get("/items")
async def list_items(user: CurrentUser, db: DbSession):
    # user["sub"] contains clerk_user_id
    # db is AsyncSession
    result = await db.execute(select(Item).where(Item.user_id == user["sub"]))
    return result.scalars().all()
```

### Adding a Database Model

1. Define model class in `apps/api/database.py` (extend `Base`)
2. Create migration: `uv run alembic revision --autogenerate -m "add table_name"`
3. Review generated migration in `alembic/versions/`
4. Apply: `uv run alembic upgrade head`

### Calling Backend from Frontend

1. Create Server Action in `apps/web/app/actions/`
2. Get token and user: `const { getToken, userId } = await auth()`
3. Call API with axios/fetch, include `Authorization: Bearer ${token}`
4. Handle response and return structured result

### Adding UI Components

- **Primitives**: Use `pnpm dlx shadcn@latest add <component>` to add shadcn/ui components to `components/ui/`
- **Feature components**: Create in `components/` root, compose from primitives
- Use `cn()` utility from `lib/utils` for className merging
- Follow patterns in `apps/web/AGENTS.md`

## Environment Variables

### Frontend (`apps/web/.env.local`)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
API_BASE_URL=http://localhost:8000
```

### Backend (`apps/api/.env`)
```
DATABASE_URL=postgresql+asyncpg://...
CLERK_SECRET_KEY=sk_...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

## Database Migrations

**When to create migrations:**
- After adding/modifying models in `database.py`
- After changing column types, constraints, or indexes

**Migration workflow:**
1. Modify `database.py` models
2. Generate migration: `uv run alembic revision --autogenerate -m "description"`
3. Review generated file in `alembic/versions/`
4. Apply: `uv run alembic upgrade head`

**Rollback:**
- One step: `uv run alembic downgrade -1`
- To specific revision: `uv run alembic downgrade <revision_id>`

## Notes

- **Next.js uses Turbopack** with workspace root configured for monorepo
- **Tailwind v4** requires `cssLayerName: "clerk"` in ClerkProvider appearance config
- **Dark mode** enabled by default via `className="dark"` on `<html>`
- **CORS** configured to allow `http://localhost:3000` in FastAPI
- **Image optimization** enabled for `github.com` and `avatars.githubusercontent.com`
- **Async database** operations required - always use `await` with database queries
