import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeading } from "@/components/page-heading";
import { ProjectCardSkeleton } from "@/components/project-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const meta: Meta = {
  title: "Pages/LoadingStates",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

// Home page loading state
export const HomePageLoading: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-5xl mx-auto p-6">
      <PageHeading>Projects</PageHeading>
      
      {/* Search and New Project skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Project cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  ),
};

// Project page loading state
export const ProjectPageLoading: Story = {
  render: () => (
    <div className="space-y-4 w-full max-w-5xl mx-auto p-6">
      {/* Tabs and New Run button */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Runs table */}
      <div className="rounded-none border border-border">
        <div className="p-4">
          {/* Table header */}
          <div className="flex gap-8 pb-3 border-b border-border">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 py-4 border-b border-border last:border-0">
              <div className="w-40 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-3" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-20 rounded-none" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

// GPU card skeleton
function GpuCardSkeleton() {
  return (
    <div className="p-3 rounded-none border border-border space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3 rounded-none" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-3 rounded-none" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

// Instance card skeleton
function InstanceCardSkeleton() {
  return (
    <div className="p-4 border border-border rounded-none space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-none" />
            <Skeleton className="h-5 w-12 rounded-none" />
            <Skeleton className="h-5 w-24 rounded-none" />
          </div>
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

// New Run page loading state
export const NewRunPageLoading: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-6xl mx-auto p-6">
      <div className="space-y-4">
        <PageHeading>New Run</PageHeading>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid w-full gap-4 sm:grid-cols-3">
            <div className="space-y-2 min-w-[180px]">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-2 min-w-[160px]">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-2 min-w-[200px]">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full lg:w-28" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row w-full">
        {/* GPU Selection Skeleton */}
        <div className="space-y-4 lg:w-64">
          <Skeleton className="h-7 w-28" />
          <div className="space-y-4 pr-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <GpuCardSkeleton key={i} />
            ))}
          </div>
        </div>
        
        {/* GPU Availability Skeleton */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <InstanceCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
};

// Settings page loading state
export const SettingsPageLoading: Story = {
  render: () => (
    <div className="space-y-6 w-full max-w-3xl mx-auto p-6">
      <PageHeading>Settings</PageHeading>
      
      {/* GitHub Connection Card */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </Card>
      
      {/* SSH Keys Card */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  ),
};

// Comparison: Loading vs Loaded
export const LoadingComparison: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 w-full max-w-4xl mx-auto p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Loading State</h3>
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-none" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-4" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24 rounded-none" />
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Loaded State</h3>
        <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-accent/50 hover:bg-accent/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-4 bg-muted rounded-none" />
              <span>octocat</span>
            </div>
            <span className="text-muted-foreground">
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
              </svg>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground-bright">
              my-ml-project
            </div>
            <div className="flex shrink-0 justify-end text-right">
              <span className="inline-flex items-center whitespace-nowrap rounded-none border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
                2 active runs
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  ),
};
