import { AppShell } from "@/components/app-shell";
import { ProjectCardSkeleton } from "@/components/project-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>

        {/* Search and New Project skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* Project cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
