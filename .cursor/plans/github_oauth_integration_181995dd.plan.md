---
name: GitHub OAuth Integration
overview: Implement GitHub App OAuth flow with Neon PostgreSQL (dev branch) for token storage, async SQLAlchemy, backend OAuth endpoints, and a frontend component showing connection status and top 5 repositories.
todos:
  - id: neon-branch
    content: Create dev branch in Neon and get connection string
    status: pending
  - id: deps
    content: Add async SQLAlchemy, asyncpg, and httpx dependencies using uv
    status: pending
  - id: database
    content: Create database.py with async SQLAlchemy engine, session, and GitHubConnection model
    status: pending
  - id: db-migrate
    content: Create github_connections table in Neon dev branch
    status: pending
  - id: github-routes
    content: Add GitHub OAuth endpoints to main.py (authorize, callback, status, repos, disconnect)
    status: pending
  - id: frontend-actions
    content: Add GitHub server actions to api.ts
    status: pending
  - id: github-component
    content: Create GitHubConnect component with connection flow and repos display
    status: pending
  - id: home-page
    content: Update /home page to include GitHubConnect component
    status: pending
---

# GitHub OAuth Integration

## Architecture Overview

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant GitHub
    participant DB as Neon_PostgreSQL

    User->>Frontend: Click "Connect to GitHub"
    Frontend->>Backend: GET /api/github/authorize
    Backend->>Frontend: Redirect URL
    Frontend->>GitHub: Redirect to OAuth
    User->>GitHub: Authorize App
    GitHub->>Backend: GET /api/github/callback?code=xxx
    Backend->>GitHub: Exchange code for tokens
    GitHub->>Backend: Access token + Refresh token
    Backend->>DB: Store tokens (clerk_user_id, tokens)
    Backend->>Frontend: Redirect to /home?github=connected
    Frontend->>Backend: GET /api/github/repos
    Backend->>GitHub: Fetch repos with token
    GitHub->>Backend: Repos data
    Backend->>Frontend: Top 5 repos
    Frontend->>User: Display repos
```

## Database Setup (Neon)

### Neon Configuration

- **Project**: RLX (`lively-bar-70784543`)
- **Branch**: `dev` (to be created from `main`)
- **Database**: `neondb`

### Connection String Format

```
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require
```

## Backend Changes

### 1. Add Dependencies

Using `uv` (project's package manager):

```bash
uv add "sqlalchemy[asyncio]" asyncpg httpx
```

- `sqlalchemy[asyncio]` - Async ORM support
- `asyncpg` - Async PostgreSQL driver (works with Neon)
- `httpx` - Async HTTP client for GitHub API

### 2. Database Setup

Create `apps/api/database.py`:

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Integer
import os

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    github_user_id = Column(String)
    github_username = Column(String)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String)
    token_expires_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

### 3. GitHub OAuth Endpoints

Add to [main.py](apps/api/main.py):

- **GET `/api/github/authorize`** - Returns GitHub OAuth URL with state parameter (state = clerk_user_id for callback)
- **GET `/api/github/callback`** - Handles OAuth callback:
  - Exchanges code for tokens via GitHub API
  - Fetches GitHub user info
  - Upserts tokens in Neon DB
  - Redirects to frontend `/home?github=connected`
  - On error: redirects to `/home?github=error&message=...`
- **GET `/api/github/status`** - Returns `{connected: boolean, username?: string}` for current user
- **GET `/api/github/repos`** - Fetches top 5 repos (sorted by updated_at)
- **POST `/api/github/disconnect`** - Deletes GitHub connection from DB

### 4. Token Refresh Logic

When access token expires:

- Use refresh token to get new access token from GitHub
- Update DB with new tokens
- If refresh fails, delete connection and return 401

## Frontend Changes

### 1. Server Actions

Add to [api.ts](apps/web/app/actions/api.ts):

- `getGitHubAuthUrl()` - Get authorization URL from backend
- `getGitHubStatus()` - Check if user is connected
- `getGitHubRepos()` - Fetch top 5 repos
- `disconnectGitHub()` - Remove connection

### 2. GitHubConnect Component

Create `apps/web/components/github-connect.tsx`:

**States:**

- `loading` - Initial check for connection status
- `disconnected` - Show "Connect to GitHub" button
- `connecting` - OAuth in progress (detected via URL params)
- `connected` - Show repos list with disconnect option
- `error` - Show error with retry button

**Features:**

- On mount: Check connection status via server action
- On button click: Redirect to backend `/api/github/authorize`
- Parse URL params `?github=connected` or `?github=error&message=...`
- Show loading skeleton while fetching repos
- Disconnect button to remove connection

### 3. Update Home Page

Update [page.tsx](apps/web/app/home/page.tsx):

- Add `GitHubConnect` component below welcome message
- Handle `searchParams` for OAuth callback detection

## Edge Case Handling

- **User denies authorization**: GitHub redirects with `?error=access_denied`, backend redirects to frontend with error message
- **User closes OAuth page**: Returns to /home, still sees "Connect" button, can retry anytime
- **Token expired**: Backend auto-refreshes; if refresh fails, returns 401 and frontend shows reconnect prompt
- **Already connected**: Skip button, directly fetch and show repos
- **GitHub API rate limit**: Return appropriate error, show "retry later" message

## Environment Variables

Add to `apps/api/.env`:

```bash
# Neon PostgreSQL (dev branch)
DATABASE_URL=postgresql+asyncpg://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require

# GitHub App
GITHUB_APP_ID=2628494
GITHUB_CLIENT_ID=Iv23litf1L1HjrvRt9MC
GITHUB_CLIENT_SECRET=<your_secret>
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```
