# RLX Next.js Refactoring Plan v2 (Parallel Routes Approach)

## Executive Summary

Refactor RLX codebase using **Parallel Routes** for breadcrumbs (better than Context/Jotai approach), plus other Next.js best practices:

1. **Breadcrumbs** - Use parallel routes `@breadcrumbs` slot (Server Components, no client state)
2. **Performance** - Add React `cache()` to eliminate duplicate API fetches
3. **Data Fetching** - Move client useEffect fetching to Server Components
4. **State Management** - Use Jotai only where needed (persistent UI state)
5. **Type Safety** - ✅ Already done in Phase 1

---

## Why Parallel Routes for Breadcrumbs?

**Old Approach (Complex):**
- ❌ Client Context API + useEffect
- ❌ Jotai atoms for breadcrumb state
- ❌ Race conditions during navigation
- ❌ Manual state synchronization
- ❌ Breadcrumb flicker

**New Approach (Parallel Routes):**
- ✅ Server-rendered from URL params
- ✅ No client state or useEffect
- ✅ Always synced with URL
- ✅ No race conditions
- ✅ Better performance

---

## Implementation Phases

### **Phase 1: Type Consolidation** ✅ COMPLETED

Already done:
- ✅ Created `/apps/web/types/index.ts` with all shared types
- ✅ `GitHubOwnerType` used everywhere
- ✅ Normalized all values to lowercase
- ✅ No re-exports from `api.ts`

---

### **Phase 2: Add React Cache Layer** (10 min)

**Goal:** Eliminate duplicate API fetches using React `cache()`

#### Create Cached API Layer

**New File:** `apps/web/lib/cached-api.ts`

```typescript
import { cache } from "react";
import {
  getProject as getProjectAction,
  getProjects as getProjectsAction,
  getGitHubStatus as getGitHubStatusAction,
  getGitHubRepos as getGitHubReposAction,
} from "@/app/actions/api";

/**
 * Cached version of getProject - prevents duplicate fetches
 * within a single request lifecycle
 */
export const getProject = cache(async (id: number) => {
  return await getProjectAction(id);
});

/**
 * Cached version of getProjects
 */
export const getProjects = cache(async () => {
  return await getProjectsAction();
});

/**
 * Cached version of getGitHubStatus
 */
export const getGitHubStatus = cache(async () => {
  return await getGitHubStatusAction();
});

/**
 * Cached version of getGitHubRepos
 */
export const getGitHubRepos = cache(async (options?: {
  page?: number;
  per_page?: number;
  search?: string;
  owner?: string;
}) => {
  return await getGitHubReposAction(options);
});
```

#### Update Imports

Change `@/app/actions/api` → `@/lib/cached-api` in:

1. `apps/web/app/(auth)/projects/[id]/layout.tsx`
2. `apps/web/app/(auth)/projects/[id]/page.tsx`
3. `apps/web/app/(auth)/home/page.tsx`

**Verification:**
- Navigate to `/projects/1` in DevTools → only ONE API call to backend
- Layout and page both call `getProject(1)` but only 1 network request

---

### **Phase 3: Parallel Routes for Breadcrumbs** (30 min)

**Goal:** Replace client-side breadcrumb state with server-rendered parallel route

#### File Structure

```
apps/web/app/(auth)/
├── layout.tsx                          # Root layout (accepts breadcrumbs slot)
├── @breadcrumbs/
│   ├── default.tsx                     # Fallback (renders null)
│   ├── home/
│   │   └── page.tsx                    # Home breadcrumbs
│   └── projects/
│       └── [id]/
│           ├── page.tsx                # Project breadcrumbs
│           └── [...rest]/
│               └── page.tsx            # Nested routes (runs, settings, etc.)
└── projects/
    └── [id]/
        ├── page.tsx
        ├── runs/
        │   └── [runId]/page.tsx
        └── settings/page.tsx
```

#### Implementation Steps

**1. Create Breadcrumb Slot Default**

**New File:** `apps/web/app/(auth)/@breadcrumbs/default.tsx`

```typescript
export default function BreadcrumbsDefault() {
  return null; // No breadcrumbs for routes without explicit breadcrumb pages
}
```

**2. Create Home Breadcrumbs**

**New File:** `apps/web/app/(auth)/@breadcrumbs/home/page.tsx`

```typescript
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

export default function HomeBreadcrumbs() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>Home</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

**3. Create Project Breadcrumbs**

**New File:** `apps/web/app/(auth)/@breadcrumbs/projects/[id]/page.tsx`

```typescript
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getProject } from "@/lib/cached-api";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectBreadcrumbs({ params }: Props) {
  const { id } = await params;

  // Fetch project name for breadcrumb
  const projectResult = await getProject(Number(id));
  const projectName = projectResult.project?.repo_name || `Project ${id}`;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/home">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{projectName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

**4. Create Nested Route Breadcrumbs (Runs, Settings, etc.)**

**New File:** `apps/web/app/(auth)/@breadcrumbs/projects/[id]/[...rest]/page.tsx`

```typescript
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getProject } from "@/lib/cached-api";

interface Props {
  params: Promise<{
    id: string;
    rest: string[];
  }>;
}

export default async function ProjectNestedBreadcrumbs({ params }: Props) {
  const { id, rest } = await params;

  // Fetch project name
  const projectResult = await getProject(Number(id));
  const projectName = projectResult.project?.repo_name || `Project ${id}`;

  // Build breadcrumbs from remaining segments
  const segments = rest.map((segment, index) => ({
    label: formatSegment(segment),
    href: `/projects/${id}/${rest.slice(0, index + 1).join("/")}`,
    isLast: index === rest.length - 1,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/home">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/projects/${id}`}>{projectName}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment) => (
          <React.Fragment key={segment.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {segment.isLast ? (
                <BreadcrumbPage>{segment.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={segment.href}>{segment.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function formatSegment(segment: string): string {
  // "new-run" → "New Run"
  // "runs" → "Runs"
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

**5. Update Auth Layout to Accept Breadcrumbs Slot**

**Modify:** `apps/web/app/(auth)/layout.tsx`

```typescript
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthLayoutContent } from "./layout-content";

export default async function AuthLayout({
  children,
  breadcrumbs, // ✅ Add breadcrumbs slot
}: {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode; // ✅ Parallel route slot
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <AuthLayoutContent breadcrumbs={breadcrumbs}>
      {children}
    </AuthLayoutContent>
  );
}
```

**6. Update Layout Content to Render Breadcrumbs Slot**

**Modify:** `apps/web/app/(auth)/layout-content.tsx`

```typescript
"use client";

import { AppHeader } from "@/components/app-header";

export function AuthLayoutContent({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

**7. Update AppHeader to Accept Breadcrumbs as Prop**

**Modify:** `apps/web/components/app-header.tsx`

```typescript
"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { Zap } from "lucide-react";
// ... other imports

export function AppHeader({ breadcrumbs }: { breadcrumbs: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <Zap className="size-5 fill-current" />
          <span className="font-semibold hidden sm:inline">RLX</span>
        </Link>

        {/* Breadcrumbs from parallel route */}
        {breadcrumbs && (
          <nav className="flex items-center text-sm">
            <span className="mx-3 text-muted-foreground/50">/</span>
            {breadcrumbs}
          </nav>
        )}

        {/* User menu */}
        <div className="ml-auto">
          {/* ... existing user menu ... */}
        </div>
      </div>
    </header>
  );
}
```

**8. Delete Old Breadcrumb Files**

- ❌ Delete `apps/web/components/breadcrumb-context.tsx`
- ❌ Delete `apps/web/app/(auth)/projects/[id]/project-breadcrumbs.tsx`

**9. Remove Breadcrumb Import from Project Page**

**Modify:** `apps/web/app/(auth)/projects/[id]/page.tsx`

Remove:
```typescript
import { ProjectBreadcrumbs } from "./project-breadcrumbs";

// And remove this line from JSX:
<ProjectBreadcrumbs currentProject={project} allProjects={allProjects} />
```

#### Verification

- Navigate to `/home` → breadcrumbs show "Home"
- Navigate to `/projects/1` → breadcrumbs show "Home / ProjectName"
- Navigate to `/projects/1/runs/123` → breadcrumbs show "Home / ProjectName / Runs / 123"
- No console errors, no useEffect warnings
- Breadcrumbs automatically sync with URL

---

### **Phase 4: Move Data Fetching to Server** (30 min)

**Goal:** Move client-side useEffect fetching to Server Components

#### For GitHubConnect

**1. Create Server Component**

**New File:** `apps/web/components/github-connect-server.tsx`

```typescript
import { getGitHubStatus } from "@/lib/cached-api";
import { GitHubConnectClient } from "./github-connect-client";

export async function GitHubConnect() {
  const statusResult = await getGitHubStatus();

  const initialState = {
    connected: statusResult.success ? (statusResult.connected ?? false) : false,
    username: statusResult.username ?? null,
    error: statusResult.success ? null : statusResult.error ?? null,
  };

  return <GitHubConnectClient initialState={initialState} />;
}
```

**2. Create Client Component**

**New File:** `apps/web/components/github-connect-client.tsx`

Copy from `github-connect.tsx` but:
- Add `"use client"` directive
- Accept `initialState` prop
- Remove `useEffect` that fetches on mount (lines 28-44)
- Initialize state from `initialState` prop

**3. Delete Old File**

- ❌ Delete `apps/web/components/github-connect.tsx`

**4. Update Home Page**

**Modify:** `apps/web/app/(auth)/home/page.tsx`

```typescript
import { GitHubConnect } from "@/components/github-connect-server";

// ... rest of component
```

#### Similar Changes for GitHubSettings and OnboardingWrapper

Follow same pattern:
- Create `*-server.tsx` (Server Component that fetches)
- Create `*-client.tsx` (Client Component that renders)
- Delete old files
- Update imports

---

### **Phase 5: Jotai for Persistent State Only** (10 min)

**Goal:** Use Jotai only for localStorage persistence (onboarding, etc.)

**Note:** We no longer need Jotai for breadcrumbs since parallel routes handle it.

**Create:** `apps/web/lib/store/onboarding.ts`

```typescript
import { atomWithStorage } from "jotai/utils";

export const onboardingDismissedAtom = atomWithStorage<boolean>(
  "rlx:onboarding_dismissed",
  false
);
```

**Update:** `apps/web/components/onboarding-client.tsx`

```typescript
"use client";
import { useAtom } from "jotai";
import { onboardingDismissedAtom } from "@/lib/store/onboarding";

export function OnboardingClient({ children, shouldShowOnboarding, hasProjects }) {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useAtom(onboardingDismissedAtom);
  // ... rest of logic
}
```

---

## Verification Checklist

### Performance
- [ ] Navigate to `/projects/1` → only 1 API call (not 2)
- [ ] DevTools Network tab shows deduplication working

### Breadcrumbs
- [ ] `/home` shows "Home" breadcrumb
- [ ] `/projects/1` shows "Home / ProjectName"
- [ ] `/projects/1/runs/123` shows full breadcrumb trail
- [ ] Breadcrumbs update instantly on navigation
- [ ] No console warnings about useEffect
- [ ] No breadcrumb flicker

### Data Fetching
- [ ] GitHub connection status loads without client-side fetch
- [ ] No useEffect warnings in console

### Build
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm build` succeeds

---

## Benefits Summary

### Breadcrumbs (Parallel Routes)
- ✅ **Simpler**: No Context, no Jotai, no useEffect
- ✅ **Faster**: Server-rendered, no client hydration
- ✅ **Reliable**: Always synced with URL, no race conditions
- ✅ **Maintainable**: Breadcrumb logic in dedicated `@breadcrumbs` slot

### Performance (React cache)
- ✅ Eliminates duplicate API calls
- ✅ Faster page loads
- ✅ Better resource utilization

### Data Fetching (Server Components)
- ✅ No client-side useEffect fetching
- ✅ Faster initial render
- ✅ Better SEO

### State Management (Jotai)
- ✅ Used only where needed (localStorage persistence)
- ✅ Not misused for route-dependent state (breadcrumbs)

---

## Migration from Old Plan

**Changes from v1:**
- ❌ Removed: Jotai atoms for breadcrumbs
- ❌ Removed: BreadcrumbContext and BreadcrumbSetter components
- ✅ Added: Parallel routes `@breadcrumbs` slot
- ✅ Simplified: Fewer moving parts, cleaner architecture

**Why Better:**
- Parallel routes are the Next.js-native way to handle breadcrumbs
- No client-side state management needed
- Automatic synchronization with URL
- Better performance (server-only)

---

**End of Plan**
