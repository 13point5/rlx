import { ProjectCardSkeleton } from "@/components/project-card";
import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeading>Projects</PageHeading>

      {/* Search and New Project skeleton */}
      <div className="flex items-center gap-3">
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
  );
}
