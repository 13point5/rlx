# Next.js App Router Patterns & Best Practices

> Notes from analyzing the Vercel Coding Agent codebase
> Source: `/Users/13point5/projects/vercel-coding-agent`

---

## Table of Contents

1. [Layout Patterns](#1-layout-patterns)
2. [Page Structure](#2-page-structure)
3. [Loading States](#3-loading-states)
4. [Data Fetching](#4-data-fetching)
5. [State Management](#5-state-management)
6. [Client vs Server Components](#6-client-vs-server-component-split)
7. [Error Handling](#7-error-handling)
8. [Route Organization](#8-route-organization)
9. [Key Architectural Patterns](#9-key-architectural-patterns)
10. [Component Composition](#10-component-composition-patterns)

---

## 1. Layout Patterns

### Root Layout with Providers

**Location:** `/app/layout.tsx`

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JotaiProvider>
          <ThemeProvider>
            <SessionProvider />
            <AppLayoutWrapper>{children}</AppLayoutWrapper>
            <Toaster />
          </ThemeProvider>
        </JotaiProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Key Patterns:**
- Multiple nested providers (state, theme, session, UI)
- Wrap all children with `AppLayoutWrapper` for shared layout logic
- Vercel Analytics/SpeedInsights at root level
- `suppressHydrationWarning` for theme-dependent content

---

### Nested Layout with Dynamic Params

**Location:** `/app/repos/[owner]/[repo]/layout.tsx`

```tsx
interface LayoutPageProps {
  params: Promise<{
    owner: string
    repo: string
  }>
  children: React.ReactNode
}

export default async function Layout({ params, children }: LayoutPageProps) {
  const { owner, repo } = await params  // ⚠️ Must await params (Next.js 15+)
  const session = await getServerSession()
  const stars = await getGitHubStars()

  // Pass server data to client component
  return (
    <RepoLayout
      owner={owner}
      repo={repo}
      user={session?.user ?? null}
      authProvider={session?.authProvider ?? null}
      initialStars={stars}
    >
      {children}
    </RepoLayout>
  )
}

export async function generateMetadata({ params }: LayoutPageProps): Promise<Metadata> {
  const { owner, repo } = await params
  return {
    title: `${owner}/${repo} - Coding Agent Platform`,
    description: 'View repository commits, issues, and pull requests',
  }
}
```

**Key Patterns:**
- ✅ Server Component doing data fetching
- ✅ Params are `Promise` objects - must be awaited
- ✅ Pass fetched data to Client Component
- ✅ Dynamic metadata generation for SEO

---

### Metadata-Only Layout

**Location:** `/app/new/[owner]/[repo]/layout.tsx`

```tsx
export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { owner, repo } = await params
  return {
    title: `${owner}/${repo} - Coding Agent`,
    description: `Create AI-powered tasks for ${owner}/${repo}`,
  }
}

export default function Layout({ children }: LayoutProps) {
  return children  // No wrapper needed, just metadata
}
```

**Use case:** When you only need route-specific metadata without layout changes

---

## 2. Page Structure

### Dynamic Page with Server-Side Data Fetching

**Location:** `/app/tasks/[taskId]/page.tsx`

```tsx
interface TaskPageProps {
  params: Promise<{
    taskId: string
  }>
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { taskId } = await params
  const session = await getServerSession()
  const maxSandboxDuration = await getMaxSandboxDuration(session?.user?.id)
  const stars = await getGitHubStars()

  return (
    <TaskPageClient
      taskId={taskId}
      user={session?.user ?? null}
      authProvider={session?.authProvider ?? null}
      initialStars={stars}
      maxSandboxDuration={maxSandboxDuration}
    />
  )
}
```

**Pattern:**
1. Server Component fetches auth, user data, initial state
2. Pass only serializable data to Client Component
3. Client Component handles interactivity

---

### Dynamic Metadata with Database Query

```tsx
export async function generateMetadata({ params }: TaskPageProps): Promise<Metadata> {
  const { taskId } = await params
  const session = await getServerSession()

  let pageTitle = `Task ${taskId}`

  if (session?.user?.id) {
    try {
      const task = await db.select().from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id)))

      if (task[0]?.title) {
        pageTitle = task[0].title
      }
    } catch (error) {
      console.error('Failed to fetch task for metadata:', error)
    }
  }

  return {
    title: `${pageTitle} - Coding Agent Platform`,
    description: 'View task details and execution logs',
  }
}
```

**Key Patterns:**
- ✅ Fetch from database for dynamic metadata
- ✅ Graceful error handling (fallback to default title)
- ✅ Conditional metadata based on auth state

---

### Redirect Page Pattern

**Location:** `/app/repos/[owner]/[repo]/page.tsx`

```tsx
export default async function RepoPage({ params }: RepoPageProps) {
  const { owner, repo } = await params
  redirect(`/repos/${owner}/${repo}/commits`)  // Redirect to default tab
}
```

**Use case:** When you want a route to always redirect to a sub-route

---

## 3. Loading States

### Automatic Loading UI

**Location:** `/app/tasks/[taskId]/loading.tsx`

```tsx
'use client'

export default function TaskLoading() {
  const { toggleSidebar } = useTasks()

  const loadingActions = (
    <div className="flex items-center gap-2 h-8">
      <GitHubStarsButton />
      <Button asChild variant="outline" size="sm">
        <a href={VERCEL_DEPLOY_URL}>Deploy</a>
      </Button>
      <div className="w-8" />  {/* Spacer for avatar to prevent layout shift */}
    </div>
  )

  return (
    <div className="flex-1 bg-background flex flex-col">
      <div className="p-3">
        <PageHeader
          showMobileMenu={true}
          onToggleMobileMenu={toggleSidebar}
          actions={loadingActions}
        />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading task...</p>
        </div>
      </div>
    </div>
  )
}
```

**Key Patterns:**
- ✅ `loading.tsx` automatically used during Server Component loading
- ✅ Use same header as actual page to prevent layout shift
- ✅ Show placeholder actions preserving space
- ✅ No data fetching - it's automatic

---

### Inline Loading in Client Component

```tsx
// Client component
if (isLoading) {
  return (
    <div className="flex-1 bg-background">
      <PageHeader actions={<LoadingActions />} />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" />
      </div>
    </div>
  )
}
```

---

## 4. Data Fetching

### Server Component with Initial State

**Location:** `/app/page.tsx`

```tsx
export default async function Home() {
  // Read cookies (server-side only)
  const cookieStore = await cookies()
  const selectedOwner = cookieStore.get('selected-owner')?.value || ''
  const selectedRepo = cookieStore.get('selected-repo')?.value || ''

  // Fetch auth and user data
  const session = await getServerSession()
  const maxSandboxDuration = await getMaxSandboxDuration(session?.user?.id)
  const stars = await getGitHubStars()

  // Pass initial state to client component
  return (
    <HomePageContent
      initialSelectedOwner={selectedOwner}
      initialSelectedRepo={selectedRepo}
      maxSandboxDuration={maxSandboxDuration}
      user={session?.user ?? null}
      initialStars={stars}
    />
  )
}
```

**Pattern:**
- Server Component reads cookies, fetches data
- Client Component receives initial state as props
- Client Component can then manage interactive state

---

### Custom Hook with Polling

**Location:** `/lib/hooks/use-task.ts`

```tsx
export function useTask(taskId: string) {
  const [task, setTask] = useState<Task | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const attemptCountRef = useRef(0)
  const hasFoundTaskRef = useRef(false)

  const fetchTask = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      if (response.ok) {
        const data = await response.json()
        setTask(data.task)
        setError(null)
        hasFoundTaskRef.current = true
      } else if (response.status === 404) {
        // Race condition handling: retry before showing error
        attemptCountRef.current += 1
        if (attemptCountRef.current >= 3 || hasFoundTaskRef.current) {
          setError('Task not found')
        }
      }
    } catch (err) {
      setError('Failed to fetch task')
    } finally {
      if (hasFoundTaskRef.current || attemptCountRef.current >= 3) {
        setIsLoading(false)
      }
    }
  }, [taskId])

  // Initial fetch with retry (race condition handling)
  useEffect(() => {
    attemptCountRef.current = 0
    fetchTask()

    const retryInterval = setInterval(() => {
      if (!hasFoundTaskRef.current && attemptCountRef.current < 3) {
        fetchTask()
      } else {
        clearInterval(retryInterval)
      }
    }, 2000)

    return () => clearInterval(retryInterval)
  }, [taskId])

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!isLoading) {
      const interval = setInterval(() => {
        fetchTask()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [fetchTask, isLoading])

  return { task, isLoading, error, refetch: fetchTask }
}
```

**Key Patterns:**
- ✅ Race condition handling for newly created resources
- ✅ Retry logic with 2-second intervals (up to 3 attempts)
- ✅ Separate polling phase after initial load
- ✅ `useCallback` to memoize fetch function
- ✅ `useRef` to track state without causing re-renders

---

### Optimistic Updates

```tsx
const addTaskOptimistically = (taskData: { prompt: string; ... }) => {
  const id = nanoid()
  const optimisticTask: Task = {
    id,
    userId: 'temp',
    prompt: taskData.prompt,
    status: 'pending',
    createdAt: new Date(),
    // ... other fields
  }

  setTasks(prev => [optimisticTask, ...prev])
  return { id, optimisticTask }
}

// Usage
const { id } = addTaskOptimistically({ prompt: '...' })
router.push(`/tasks/${id}`)  // Navigate immediately
// Background fetch will replace optimistic data
```

---

### API Routes with Dynamic Params

**Location:** `/app/api/repos/[owner]/[repo]/commits/route.ts`

```tsx
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const { owner, repo } = await context.params  // ⚠️ Await params

    const octokit = await getOctokit()

    if (!octokit.auth) {
      return NextResponse.json(
        { error: 'GitHub authentication required' },
        { status: 401 }
      )
    }

    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 30,
    })

    return NextResponse.json({ commits })
  } catch (error) {
    console.error('Error fetching commits:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commits' },
      { status: 500 }
    )
  }
}
```

**Key Patterns:**
- ✅ Await `context.params` for dynamic routes
- ✅ Proper error handling with status codes
- ✅ Consistent JSON response format

---

### API Route with Post-Response Processing

**Location:** `/app/api/tasks/route.ts`

```tsx
export async function POST(request: NextRequest) {
  const session = await getServerSession()
  const body = await request.json()
  const taskId = body.id || generateId(12)

  // Insert task
  const [newTask] = await db.insert(tasks).values({
    id: taskId,
    userId: session.user.id,
    prompt: body.prompt,
    status: 'pending',
    // ...
  }).returning()

  // ✅ Generate branch name asynchronously (after response sent)
  after(async () => {
    try {
      const aiBranchName = await generateBranchName({ prompt: body.prompt })
      await db.update(tasks)
        .set({ branchName: aiBranchName })
        .where(eq(tasks.id, taskId))
    } catch (error) {
      console.error('Failed to generate branch name:', error)
    }
  })

  // ✅ Process task with timeout (non-blocking)
  after(async () => {
    try {
      await processTaskWithTimeout(taskId, body, session.user.id)
    } catch (error) {
      console.error('Task processing failed:', error)
    }
  })

  return NextResponse.json({ task: newTask })  // Response sent immediately
}
```

**Key Pattern:**
- Use `after()` for non-blocking operations
- Client gets fast response
- Heavy processing happens in background

---

## 5. State Management

### Jotai Atoms with localStorage Persistence

**Location:** `/lib/atoms/task.ts`

```tsx
import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai/utils'

// Simple persistent atom
export const taskPromptAtom = atomWithStorage('task-prompt', '')

// Atom family for per-task state
export const taskChatInputAtomFamily = atomFamily((taskId: string) =>
  atomWithStorage(`task-chat-input-${taskId}`, '')
)

// Multi-repo mode
export const multiRepoModeAtom = atomWithStorage('multi-repo-mode', false)
export const selectedReposAtom = atomWithStorage<SelectedRepo[]>('selected-repos', [])
```

---

### Jotai Provider Setup

**Location:** `/components/providers/jotai-provider.tsx`

```tsx
'use client'

import { Provider } from 'jotai'

export function JotaiProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>
}
```

**Root layout:**
```tsx
<JotaiProvider>
  <ThemeProvider>
    {children}
  </ThemeProvider>
</JotaiProvider>
```

---

### Using Atoms in Components

```tsx
'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'

function Component() {
  // Read and write
  const [prompt, setPrompt] = useAtom(taskPromptAtom)

  // Read only
  const multiRepoMode = useAtomValue(multiRepoModeAtom)

  // Write only
  const setTaskPrompt = useSetAtom(taskPromptAtom)

  // Atom family
  const [chatInput, setChatInput] = useAtom(taskChatInputAtomFamily(taskId))
}
```

---

### React Context for App-Level State

**Location:** `/components/app-layout.tsx`

```tsx
interface TasksContextType {
  refreshTasks: () => Promise<void>
  toggleSidebar: () => void
  isSidebarOpen: boolean
  isSidebarResizing: boolean
  addTaskOptimistically: (taskData: {...}) => { id: string; optimisticTask: Task }
}

const TasksContext = createContext<TasksContextType | undefined>(undefined)

export const useTasks = () => {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error('useTasks must be used within AppLayout')
  }
  return context
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const value = {
    refreshTasks,
    toggleSidebar,
    isSidebarOpen,
    isSidebarResizing,
    addTaskOptimistically,
  }

  return (
    <TasksContext.Provider value={value}>
      <div className="flex">
        <Sidebar />
        <main>{children}</main>
      </div>
    </TasksContext.Provider>
  )
}
```

**Usage:**
```tsx
'use client'

function Component() {
  const { toggleSidebar, addTaskOptimistically } = useTasks()
}
```

---

### Sidebar State with Cookie Persistence

```tsx
const updateSidebarOpen = useCallback((isOpen: boolean, saveToCookie = true) => {
  setIsSidebarOpen(isOpen)
  if (saveToCookie && typeof window !== 'undefined' && window.innerWidth >= 1024) {
    setSidebarOpen(isOpen)  // Save to cookie via server action
  }
}, [])

// Read from cookies on mount
useEffect(() => {
  const actualIsDesktop = window.innerWidth >= 1024
  if (actualIsDesktop !== isDesktop) {
    setIsDesktop(actualIsDesktop)
    if (!actualIsDesktop) {
      setIsSidebarOpen(false)
    } else if (actualIsDesktop && initialIsMobile) {
      const savedPreference = getSidebarOpen()
      setIsSidebarOpen(savedPreference ?? initialSidebarOpen ?? true)
    }
  }
  setHasMounted(true)
}, [isDesktop, initialIsMobile, initialSidebarOpen])
```

**Pattern:**
- Server Component reads cookie and passes initial state
- Client Component manages interactive state
- Changes are persisted back to cookies via server action

---

## 6. Client vs Server Component Split

### Server Component (page.tsx)

```tsx
// ✅ Server Component - No 'use client' directive
export default async function TaskPage({ params }: TaskPageProps) {
  // ✅ Can read cookies
  const cookieStore = await cookies()

  // ✅ Can get session/auth
  const session = await getServerSession()

  // ✅ Can query database directly
  const task = await db.select().from(tasks)
    .where(eq(tasks.id, taskId))

  // ✅ Pass data to client component
  return (
    <TaskPageClient
      taskId={taskId}
      user={session?.user ?? null}
      initialTask={task[0]}
    />
  )
}
```

**Server Components can:**
- ✅ Fetch data directly from database
- ✅ Read cookies and headers
- ✅ Use secrets (API keys, etc.)
- ✅ Keep sensitive logic server-side
- ❌ Cannot use hooks (useState, useEffect, etc.)
- ❌ Cannot use browser APIs
- ❌ Cannot handle user interactions

---

### Client Component

```tsx
'use client'  // ⚠️ Required directive

export function TaskPageClient({
  taskId,
  user,
  initialTask,
}: TaskPageClientProps) {
  // ✅ Can use hooks
  const { task, isLoading } = useTask(taskId)
  const [logsPaneHeight, setLogsPaneHeight] = useState(40)

  // ✅ Can use context
  const { toggleSidebar } = useTasks()

  // ✅ Can handle events
  const handleClick = () => { /* ... */ }

  if (isLoading) {
    return <LoadingUI />
  }

  return (
    <div className="flex-1" onClick={handleClick}>
      <TaskDetails task={task} />
      <LogsPane onHeightChange={setLogsPaneHeight} />
    </div>
  )
}
```

**Client Components can:**
- ✅ Use React hooks
- ✅ Handle user interactions
- ✅ Use browser APIs
- ✅ Manage local state
- ❌ Cannot read cookies/headers directly
- ❌ Cannot query database directly
- ❌ Cannot access server-only modules

---

### AppLayoutWrapper Pattern (Server → Client Bridge)

**Server Component:**
```tsx
// /components/app-layout-wrapper.tsx
export async function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  // ✅ Read cookies (server-side)
  const cookieStore = await cookies()
  const initialSidebarWidth = getSidebarWidthFromCookie(cookieStore.toString())
  const initialSidebarOpen = getSidebarOpenFromCookie(cookieStore.toString())

  // ✅ Read headers (server-side)
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  const isMobile = /Android|webOS|iPhone/i.test(userAgent)

  // ✅ Pass initial state to client component
  return (
    <AppLayout
      initialSidebarWidth={initialSidebarWidth}
      initialSidebarOpen={initialSidebarOpen}
      initialIsMobile={isMobile}
    >
      {children}
    </AppLayout>
  )
}
```

**Client Component:**
```tsx
'use client'

export function AppLayout({
  children,
  initialSidebarWidth,
  initialSidebarOpen,
  initialIsMobile,
}: AppLayoutProps) {
  // Use initial values from server
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth)
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialSidebarOpen)
  const [isMobile, setIsMobile] = useState(initialIsMobile)

  // ... manage interactive state
}
```

---

## 7. Error Handling

### Custom Not Found Page

**Location:** `/app/tasks/[taskId]/not-found.tsx`

```tsx
export default function TaskNotFound() {
  return (
    <div className="flex-1 bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Task Not Found</h1>
        <p className="text-muted-foreground">
          The task you're looking for doesn't exist or may have been deleted.
        </p>
        <Button asChild className="mt-4">
          <Link href="/tasks">View All Tasks</Link>
        </Button>
      </div>
    </div>
  )
}
```

**Trigger from page:**
```tsx
import { notFound } from 'next/navigation'

export default async function TaskPage({ params }) {
  const task = await getTask(params.taskId)

  if (!task) {
    notFound()  // Shows not-found.tsx
  }

  return <TaskPageClient task={task} />
}
```

---

### Client Component Error States

```tsx
'use client'

export function TaskPageClient({ taskId }: Props) {
  const { task, isLoading, error } = useTask(taskId)

  if (error || !task) {
    return (
      <div className="flex-1 bg-background">
        <PageHeader actions={<Actions />} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Task Not Found</h2>
            <p className="text-muted-foreground">
              {error || 'The requested task could not be found.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <TaskContent task={task} />
}
```

---

### API Error Responses

```tsx
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession()

    // ✅ 401 Unauthorized
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { taskId } = await params
    const task = await db.select().from(tasks)
      .where(and(
        eq(tasks.id, taskId),
        eq(tasks.userId, session.user.id)
      ))

    // ✅ 404 Not Found
    if (!task[0]) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // ✅ 200 Success
    return NextResponse.json({ task: task[0] })

  } catch (error) {
    // ✅ 500 Server Error
    console.error('Error fetching task:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    )
  }
}
```

---

## 8. Route Organization

### File Structure

```
/app
  /layout.tsx                    # Root layout with providers
  /page.tsx                      # Home page

  /tasks
    /page.tsx                    # Tasks list
    /[taskId]
      /page.tsx                  # Task detail
      /loading.tsx               # Loading state
      /not-found.tsx             # 404 page

  /repos
    /[owner]
      /[repo]
        /layout.tsx              # Repo wrapper layout
        /page.tsx                # Redirects to /commits
        /commits
          /page.tsx
        /issues
          /page.tsx
        /pull-requests
          /page.tsx

  /new
    /[owner]
      /[repo]
        /layout.tsx              # Metadata-only layout
        /page.tsx

  /api
    /tasks
      /route.ts                  # GET, POST, DELETE
      /[taskId]
        /route.ts                # GET, PATCH, DELETE
        /messages
          /route.ts              # POST
    /repos
      /[owner]
        /[repo]
          /commits
            /route.ts
          /issues
            /route.ts
```

### Route Patterns

**1. List + Detail Pattern**
```
/tasks/page.tsx          → List of tasks
/tasks/[id]/page.tsx     → Task detail
```

**2. Nested Dynamic Routes**
```
/repos/[owner]/[repo]/commits/page.tsx
/repos/[owner]/[repo]/issues/page.tsx
```

**3. API Routes Mirror App Routes**
```
App:  /tasks/[taskId]
API:  /api/tasks/[taskId]
```

---

## 9. Key Architectural Patterns

### 1. Session Management with React `cache()`

**Location:** `/lib/session/get-server-session.ts`

```tsx
import { cache } from 'react'

export const getServerSession = cache(async () => {
  const store = await cookies()
  const cookieValue = store.get(SESSION_COOKIE_NAME)?.value

  if (!cookieValue) {
    return null
  }

  return getSessionFromCookie(cookieValue)
})
```

**Why `cache()`:**
- Deduplicates server-side session calls within a single render
- Multiple components can call `getServerSession()` but only fetches once
- Request-scoped caching (cleared after request)

**Usage:**
```tsx
// Multiple components in same render can call this
const session = await getServerSession()
```

---

### 2. Database Client with Lazy Initialization

**Location:** `/lib/db/client.ts`

```tsx
let _db: ReturnType<typeof drizzle> | null = null

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!_db) {
      const client = postgres(process.env.POSTGRES_URL!)
      _db = drizzle(client, { schema })
    }
    return Reflect.get(_db, prop)
  },
})
```

**Why:**
- Lazy initialization prevents multiple DB connections
- Connection only created when first query is made
- Proxy pattern allows type-safe usage

**Usage:**
```tsx
const tasks = await db.select().from(tasks).where(...)
```

---

### 3. Optimistic UI Updates Pattern

```tsx
// 1. Generate temporary ID
const tempId = nanoid()

// 2. Add optimistic data to state
setTasks(prev => [{
  id: tempId,
  status: 'pending',
  ...data
}, ...prev])

// 3. Navigate immediately
router.push(`/tasks/${tempId}`)

// 4. API call creates real resource
const response = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify(data)
})

// 5. Page polls for real data
// useTask hook handles race condition with retry logic
```

**Benefits:**
- Instant UI feedback
- Better perceived performance
- Handles async creation gracefully

---

### 4. Responsive Layout with Mobile Detection

```tsx
// Server-side detection
const headersList = await headers()
const userAgent = headersList.get('user-agent') || ''
const isMobile = /Android|webOS|iPhone|iPad/i.test(userAgent)

// Pass to client
<AppLayout initialIsMobile={isMobile}>

// Client-side verification
useEffect(() => {
  const actualIsDesktop = window.innerWidth >= 1024
  if (actualIsDesktop !== isDesktop) {
    setIsDesktop(actualIsDesktop)
    // Adjust UI accordingly
  }
}, [])
```

**Why both:**
- Server detection prevents hydration flash
- Client verification handles resize and orientation changes

---

### 5. Persistent UI State with Cookies

```tsx
// Server: Read initial state
const cookieStore = await cookies()
const sidebarWidth = Number(cookieStore.get('sidebar-width')?.value || 280)

// Client: Update state
const updateSidebarWidth = (width: number) => {
  setSidebarWidth(width)
  setSidebarWidthCookie(width)  // Server action
}
```

**Benefits:**
- Persists across sessions
- Server can read for initial render (no flash)
- Works with JS disabled

---

## 10. Component Composition Patterns

### Layout Wrapper Pattern

```tsx
// Server Component Layout
async function RepoLayout({ params, children }: LayoutProps) {
  const { owner, repo } = await params
  const session = await getServerSession()
  const stars = await getGitHubStars()

  return (
    <RepoLayoutClient
      owner={owner}
      repo={repo}
      user={session?.user ?? null}
      initialStars={stars}
    >
      {children}
    </RepoLayoutClient>
  )
}

// Client Component Layout
'use client'
function RepoLayoutClient({ owner, repo, children, ...props }: Props) {
  const pathname = usePathname()
  const activeTab = pathname.split('/').pop()

  return (
    <div className="flex-1">
      <PageHeader {...props} />
      <TabNavigation owner={owner} repo={repo} activeTab={activeTab} />
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
```

**Pattern:**
- Server layout fetches data
- Client layout handles navigation/interactivity
- Children can be server or client components

---

### Sidebar + Main Content Pattern

```tsx
<AppLayout>  {/* Client context provider */}
  <div className="flex h-screen">
    <TaskSidebar  // Client component with state
      tasks={tasks}
      onTaskSelect={handleSelect}
    />
    <div className="flex-1">
      {children}  {/* Page content (can be server component) */}
    </div>
  </div>
</AppLayout>
```

---

### Resizable Panel Pattern

```tsx
'use client'

export function ResizableSidebar({ children }: Props) {
  const [width, setWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = () => setIsResizing(true)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = e.clientX
    setWidth(Math.max(200, Math.min(500, newWidth)))
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', () => setIsResizing(false))
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove])

  return (
    <div style={{ width }} className="relative">
      {children}
      <div
        className="absolute right-0 top-0 w-1 h-full cursor-col-resize"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
```

---

## Summary & Key Takeaways

### ✅ Best Practices Observed

1. **Clear Server/Client boundaries**
   - Server Components for data fetching, auth, DB queries
   - Client Components for interactivity, hooks, browser APIs
   - Use `'use client'` directive intentionally

2. **Efficient data flow**
   - Server fetches → pass to Client as props
   - Client manages interactive state locally
   - Use Context for app-level client state
   - Use Jotai for cross-component shared state

3. **Performance optimizations**
   - `cache()` for request deduplication
   - `after()` for post-response processing
   - Optimistic updates for instant feedback
   - Lazy initialization for expensive resources

4. **State persistence**
   - Cookies for cross-session UI preferences
   - localStorage via Jotai for form state
   - URL params for shareable state

5. **Loading & error states**
   - `loading.tsx` for automatic loading UI
   - `not-found.tsx` for custom 404 pages
   - Graceful error handling with fallbacks
   - Preserve layout during loading (prevent shifts)

6. **Type safety**
   - Drizzle ORM for type-safe DB queries
   - TypeScript throughout
   - Proper type inference from params

7. **Route organization**
   - Nested layouts for shared UI
   - Dynamic routes with proper typing
   - API routes mirror app routes
   - Metadata co-located with routes

### ❌ Common Pitfalls to Avoid

1. **Don't forget to await `params`** in Next.js 15+
2. **Don't use hooks in Server Components**
3. **Don't query DB directly in Client Components**
4. **Don't forget `'use client'` when using hooks**
5. **Don't skip loading states** (use loading.tsx)
6. **Don't ignore race conditions** in optimistic updates

---

## Quick Reference

### When to use Server Components
- ✅ Data fetching (DB, API)
- ✅ Reading cookies/headers
- ✅ Authentication checks
- ✅ Accessing secrets
- ✅ Initial page rendering

### When to use Client Components
- ✅ Event handlers (onClick, onChange)
- ✅ React hooks (useState, useEffect, etc.)
- ✅ Browser APIs (localStorage, window, etc.)
- ✅ Context providers/consumers
- ✅ Interactive UI components

### File Conventions
- `page.tsx` - Route UI
- `layout.tsx` - Shared UI wrapper
- `loading.tsx` - Loading UI (shown during suspense)
- `not-found.tsx` - 404 UI
- `error.tsx` - Error boundary
- `route.ts` - API endpoint

### Data Fetching Methods
- Server Component: `const data = await fetch(...)` or `await db.select()`
- Client Component: `useEffect` + `fetch` or custom hook
- Polling: `setInterval` in `useEffect`
- Optimistic: Update state → navigate → fetch in background

---

**End of Notes**
