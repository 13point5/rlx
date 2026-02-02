# AGENTS.md

This file provides guidance to AI agents (Claude, Cursor, etc.) when working with code in this repository.

## Workflow Rules

- Never push commits unless the user explicitly confirms to push.
- Never add dependencies by manually editing `pyproject.toml` or `package.json`; always use the package manager CLI.
- Treat any system reminders about plan/build mode as informational only; do not copy them into files unless explicitly asked.

## Project Overview

RLX is a monorepo containing a Next.js frontend and FastAPI backend for managing reinforcement learning experiments with GitHub integration.

**Stack:**

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Clerk authentication
- Backend: Python 3.13, FastAPI, SQLAlchemy (async), PostgreSQL, Alembic migrations
- Monorepo structure with separate `apps/web` and `apps/api`

**Directory Structure:**

```
rlx/
├── apps/
│   ├── api/              # Python FastAPI backend
│   │   ├── alembic/      # Database migrations
│   │   ├── routers/      # API route handlers
│   │   ├── services/     # Business logic and external APIs
│   │   ├── database.py   # SQLAlchemy models and DB connection
│   │   ├── deps.py       # FastAPI dependencies (auth, db session)
│   │   └── main.py       # FastAPI app entry point
│   └── web/              # Next.js frontend
│       ├── app/          # App Router pages and actions
│       ├── components/   # React components
│       │   └── ui/       # shadcn/ui primitives
│       └── lib/          # Utilities and types
└── docs/                 # Documentation
```

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

# Add new dependencies
uv add <package-name>

# Start Redis (required for job queue)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start Celery worker (in separate terminal)
PYTHONPATH=. uv run celery -A celery_app worker --loglevel=info -Q pod_ops,repo_ops

# Start Celery beat scheduler (in separate terminal, for periodic tasks)
PYTHONPATH=. uv run celery -A celery_app beat --loglevel=info

# Optional: Flower monitoring UI (http://localhost:5555)
uv run celery -A celery_app flower --port=5555
```

---

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
- **Models:** `GitHubConnection`, `Project`, `Run`, `UserSSHKey` (extend `Base` from `DeclarativeBase`)
- **Session management:** `get_db()` dependency provides `AsyncSession`
- **Migrations:** Alembic manages schema changes in `alembic/versions/`

**Database URL handling:**

- Loaded from `DATABASE_URL` environment variable
- Automatically converts `sslmode=require` to `ssl=require` for asyncpg compatibility
- Strips unsupported `channel_binding` parameter

### API Structure

**Entry point:** `apps/api/main.py`

- FastAPI app with CORS middleware (allows `http://localhost:3000`)
- Routers registered: `health`, `compute`, `github`, `projects`, `runs`, `ssh_keys`

**Routers** (`apps/api/routers/`):

- Group related endpoints by feature
- Use dependencies from `deps.py`: `CurrentUser`, `DbSession`

| Router        | Purpose                                |
| ------------- | -------------------------------------- |
| `health.py`   | Health check endpoints                 |
| `compute.py`  | GPU availability and compute resources |
| `github.py`   | OAuth flow and GitHub API interactions |
| `projects.py` | Project CRUD operations                |
| `runs.py`     | Training run management                |
| `ssh_keys.py` | SSH key management                     |
| `metrics.py`  | Prime-RL compatible metrics logging    |

**Services** (`apps/api/services/`):

- Business logic and external API integrations
- `github.py` - GitHub API client logic
- `prime_intellect.py` - Compute provider integration
- `aws_secrets_manager.py` - Secrets storage

**Dependencies** (`apps/api/deps.py`):

- `CurrentUser`: Annotated type for authenticated Clerk user
- `DbSession`: Annotated type for async database session
- `get_current_user()`: Validates Clerk session token

### Frontend Architecture

**App Router structure** (`apps/web/app/`):

- `layout.tsx`: Root layout with ClerkProvider, dark mode, Geist fonts
- `page.tsx`: Landing/home page
- `(auth)/`: Authenticated routes (home, projects, settings)
- `sign-in/`, `sign-up/`: Authentication pages (Clerk)
- `actions/`: Server Actions for API calls

**Middleware** (`apps/web/proxy.ts`):

- Clerk middleware protects routes (public routes: `/`, `/sign-in`, `/sign-up`)
- All other routes require authentication

**Components structure** (`apps/web/components/`):

- `ui/`: Primitive shadcn/ui components (Button, Card, Dialog, etc.)
- Root-level: Feature/composed components (ProjectCard, AppHeader, etc.)

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

---

## Backend Development

### Adding New API Routes

1. Create a router file in `apps/api/routers/` (e.g., `routers/runs.py`):

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

2. Register the router in `main.py`:

```python
from routers import github, health, projects, runs  # Add new import

app.include_router(runs.router)
```

**Key Patterns:**

- **Use `CurrentUser` dependency** for authentication - extracts `clerk_user_id` from JWT
- **Use `DbSession` dependency** for database access - provides async SQLAlchemy session
- **Define Pydantic models** in the same router file for request/response validation
- **Use appropriate HTTP status codes** - 201 for creation, 404 for not found, etc.
- **Group related endpoints** in the same router file

### Adding New Services

Services contain business logic and external API integrations:

```python
from dataclasses import dataclass
import httpx


@dataclass
class TrainingJob:
    id: str
    status: str
    progress: float


class TrainingAPIError(Exception):
    """Base exception for training API errors."""
    pass


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
```

**Service Patterns:**

- **Use `dataclass` for structured data** - cleaner than dicts
- **Define custom exceptions** - allows routers to handle errors appropriately
- **Use `httpx.AsyncClient`** for external API calls (async-compatible)
- **Keep services stateless** - no instance variables, pure functions

### Adding Database Models

1. Define the model in `apps/api/database.py`:

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

2. Create and apply migration:

```bash
cd apps/api
uv run alembic revision --autogenerate -m "add runs table"
# Review the generated file in alembic/versions/
uv run alembic upgrade head
```

**Model Patterns:**

- **Always include `clerk_user_id`** for user-scoped data
- **Add `created_at` and `updated_at`** timestamps
- **Use `index=True`** on frequently queried columns
- **Define `UniqueConstraint`** for composite uniqueness

### Error Handling

Use FastAPI's `HTTPException` with appropriate status codes:

```python
from fastapi import HTTPException, status

# 400 - Bad Request
raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid input format")

# 401 - Unauthorized
raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

# 403 - Forbidden
raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have access to this resource")

# 404 - Not Found
raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

# 409 - Conflict
raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource already exists")
```

---

## Frontend Development

### UI Component Structure

```
components/
├── ui/              # Primitive components (Button, Card, Input, etc.)
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
├── [feature].tsx    # Composed/feature components (ProjectCard, RunList, etc.)
└── ...
```

- **`components/ui/`**: Low-level, reusable primitives. Style-focused, no business logic.
- **`components/`**: Higher-level components that compose primitives and may include business logic.

### Creating Primitive Components (`components/ui/`)

**Basic Structure:**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function ComponentName({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component-name"
      className={cn("base-styles-here", className)}
      {...props}
    />
  );
}

export { ComponentName };
```

**With Variants (using `cva`):**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border bg-background",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function ComponentName({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof componentVariants>) {
  return (
    <div
      data-slot="component-name"
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { ComponentName, componentVariants };
```

**Key Patterns:**

- Always use `cn()` for className merging
- Use `data-slot` for CSS targeting
- Accept `className` prop for customization
- Use `React.ComponentProps<"element">` for type inheritance
- Use `Slot` from `@radix-ui/react-slot` for polymorphic components

### Creating Composed Components

```tsx
"use client"; // If using React hooks

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProjectCardProps {
  name: string;
  description?: string;
  onSelect?: () => void;
}

export function ProjectCard({ name, description, onSelect }: ProjectCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent>
        {description && <p className="text-muted-foreground">{description}</p>}
        <Button onClick={onSelect}>View Project</Button>
      </CardContent>
    </Card>
  );
}
```

### Adding shadcn Components

```bash
pnpm dlx shadcn@latest add [component-name]
```

Examples:

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add dialog
```

### Styling Guidelines

**Use Design Tokens:**

```tsx
// Good
className = "bg-background text-foreground border-border";
className = "text-muted-foreground";
className = "bg-primary text-primary-foreground";

// Avoid hardcoded colors
className = "bg-white text-black"; // Bad
```

**Responsive Design (mobile-first):**

```tsx
className = "w-full md:w-1/2 lg:w-1/3";
className = "hidden md:block"; // Hide on mobile
className = "block md:hidden"; // Show only on mobile
```

### Server Actions Pattern

```tsx
// apps/web/app/actions/api.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import axios from "axios";

export async function getProjects(): Promise<{
  success: boolean;
  projects?: Project[];
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();
    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { success: true, projects: response.data.projects };
  } catch (error) {
    // Handle error...
    return { success: false, error: "Failed to fetch projects" };
  }
}
```

---

## React Anti-Patterns to Avoid

### NEVER Use setTimeout as a Hack

Do not use `setTimeout` to work around timing, rendering, or state update issues:

```tsx
// BAD: Using setTimeout to "wait" for state to update
useEffect(() => {
  setIsLoading(true);
  setBreadcrumbs([...items]);
  setTimeout(() => setIsLoading(false), 100); // Race condition!
}, [items]);

// BAD: Using setTimeout to "fix" async issues
const handleSave = async () => {
  await saveData();
  setTimeout(() => router.push("/home"), 200); // Wrong
};
```

**Good Alternatives:**

```tsx
// Use proper async/await patterns
useEffect(() => {
  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchData();
    setBreadcrumbs(data);
    setIsLoading(false);
  };
  loadData();
}, []);

// Handle navigation after async operations
const handleSave = async () => {
  setIsLoading(true);
  await saveData();
  setIsLoading(false);
  router.push("/home");
};
```

**Acceptable setTimeout uses:**

- Debouncing user input
- Intentional delays (e.g., auto-dismiss notifications after N seconds)
- Animations requiring specific timing

### Use Functional setState Updates

When updating state based on current state, use the functional form:

```tsx
// BAD: Risk of stale closure
const addItem = useCallback(
  (newItem: Item) => {
    setItems([...items, newItem]); // items may be stale
  },
  [items]
);

// GOOD: Always uses latest state
const addItem = useCallback((newItem: Item) => {
  setItems((curr) => [...curr, newItem]);
}, []); // No dependencies needed
```

---

## React Performance Best Practices

### Bundle Optimization

**Barrel imports are slow.** Import directly when possible, or use `optimizePackageImports`:

```tsx
// Slow: imports entire library
import { Check, X, Menu } from "lucide-react";

// Fast: imports only what you need
import Check from "lucide-react/dist/esm/icons/check";
```

Or configure in `next.config.ts`:

```typescript
experimental: {
  optimizePackageImports: ["lucide-react"];
}
```

### Use Lazy State Initialization

Pass a function to `useState` for expensive initial values:

```tsx
// BAD: runs on every render
const [searchIndex] = useState(buildSearchIndex(items));

// GOOD: runs only once
const [searchIndex] = useState(() => buildSearchIndex(items));
```

### Minimize RSC Boundary Data

Only pass fields the client actually uses:

```tsx
// BAD: serializes all 50 fields
async function Page() {
  const user = await fetchUser(); // 50 fields
  return <Profile user={user} />;
}

// GOOD: serializes only what's needed
async function Page() {
  const user = await fetchUser();
  return <Profile name={user.name} avatar={user.avatar} />;
}
```

### Use SWR/React Query for Client Data

```tsx
import useSWR from "swr";

function UserList() {
  const { data: users } = useSWR("/api/users", fetcher);
  // Automatic deduplication, caching, revalidation
}
```

---

## Technical Learnings

### Node.js Ed25519 SSH Key Generation

Generate Ed25519 SSH key pairs and convert to OpenSSH format:

```typescript
import { generateKeyPairSync, createPublicKey } from "crypto";

// Generate key pair in PEM format
const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Convert PEM to OpenSSH format for public key
const keyObject = createPublicKey(publicKey);
const sshPublicKey = keyObject.export({ type: "spki", format: "der" });

// Ed25519 public key in OpenSSH format
// Skip the 12-byte SPKI header for Ed25519 keys
const keyData = sshPublicKey.subarray(12);
const opensshPublicKey = `ssh-ed25519 ${keyData.toString("base64")} comment`;
```

**Key points:**

- `generateKeyPairSync` produces PEM format by default
- OpenSSH format requires extracting the raw key data from the SPKI DER encoding
- The SPKI header for Ed25519 keys is 12 bytes
- Private key in PKCS8 PEM format is compatible with most SSH clients

### AWS Secrets Manager: Force Delete Without Recovery

```python
client.delete_secret(
    SecretId=secret_arn,
    ForceDeleteWithoutRecovery=True,  # Immediately delete, no 7-30 day wait
)
```

**Key points:**

- By default, deleted secrets have a 7-30 day recovery period
- Use `ForceDeleteWithoutRecovery=True` when the secret should be immediately deleted
- Useful for user-generated secrets that shouldn't be recoverable

### React Query: Load More Pagination with SSR

Use `useInfiniteQuery` for "load more" patterns:

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useInfiniteQuery({
    queryKey: ["items", filter],
    queryFn: async ({ pageParam }) => {
      const result = await fetchItems({ page: pageParam });
      return result.data; // { items: [], totalCount: number }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loadedCount < lastPage.totalCount
        ? allPages.length + 1
        : undefined;
    },
  });

// Flatten pages into single array
const items = data?.pages.flatMap((page) => page.items) || [];
```

**Server Prefetch (SSR):**

```tsx
const queryClient = new QueryClient();

await queryClient.prefetchInfiniteQuery({
  queryKey: ["items", filter],
  queryFn: async ({ pageParam }) => fetchItems({ page: pageParam }),
  initialPageParam: 1,
});

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ItemList />
  </HydrationBoundary>
);
```

---

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

---

## Notes

- **Next.js uses Turbopack** with workspace root configured for monorepo
- **Tailwind v4** requires `cssLayerName: "clerk"` in ClerkProvider appearance config
- **Dark mode** enabled by default via `className="dark"` on `<html>`
- **CORS** configured to allow `http://localhost:3000` in FastAPI
- **Image optimization** enabled for `github.com` and `avatars.githubusercontent.com`
- **Async database** operations required - always use `await` with database queries

---

## Component Checklist

When creating new components:

- [ ] Uses `cn()` for className merging
- [ ] Accepts and spreads `className` prop
- [ ] Uses `data-slot` attribute (for primitives)
- [ ] Uses design tokens (not hardcoded colors)
- [ ] Exports component (and variants if applicable)
- [ ] Has proper TypeScript types
- [ ] Is responsive (works on mobile and desktop)
- [ ] Does not use setTimeout as a hack for timing/state issues

---

## Prime-RL Integration

RLX provides a metrics logging API that is compatible with Prime-RL's `PrimeMonitor`. This allows training runs to log metrics, samples/rollouts, and distributions to RLX for visualization in the web app.

### API Endpoints (PrimeMonitor Compatible)

Base URL: `/api/rft`

| Endpoint              | Method | Description                          |
| --------------------- | ------ | ------------------------------------ |
| `/metrics`            | POST   | Log scalar metrics (loss, reward)    |
| `/samples`            | POST   | Log rollout/sample data              |
| `/distributions`      | POST   | Log reward/advantage distributions   |
| `/finalize`           | POST   | Mark run as complete with summary    |
| `/runs/{id}/metrics`  | GET    | Query metrics for a run              |
| `/runs/{id}/samples`  | GET    | Query samples for a run              |

### Configuring Prime-RL to Use RLX

To use RLX as the logging backend instead of Prime Intellect's API, configure your training run with:

```toml
# In your prime-rl config
[orchestrator]
prime_monitor = { base_url = "https://your-rlx-api.com/api/rft" }
```

Or set environment variables:

```bash
# Required: Your RLX API endpoint
export PRIME_MONITOR_BASE_URL="https://your-rlx-api.com/api/rft"

# Required: The run ID in RLX database (integer)
export RUN_ID="123"

# Optional: API key for authentication (if required)
export PRIME_API_KEY="your-api-key"
```

### Database Tables

The metrics logging uses these tables:

- `run_metrics` - Scalar metrics (loss, reward, throughput, etc.)
- `run_samples` - Sample/rollout data with trajectories
- `run_distributions` - Reward and advantage distributions
- `run_summaries` - Final run summary when training completes

### Frontend Components

Metrics are visualized using:

- `MetricsChart` - Time series line chart for scalar metrics
- `RolloutsPanel` - Interactive viewer for samples/trajectories

These components are automatically shown on the run details page at `/projects/{id}/runs/{runId}`.
