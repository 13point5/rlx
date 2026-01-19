import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div className="space-y-4">
      {/* Header with PageHeading */}
      <div className="space-y-4">
        <PageHeading>Runs</PageHeading>
        {/* Tabs and New Run button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-full sm:w-28" />
        </div>
      </div>

      {/* Runs table */}
      <div className="border border-border overflow-hidden rounded-none">
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
  );
}
