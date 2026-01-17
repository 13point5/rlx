import { PageHeading } from "@/components/page-heading";
import { Skeleton } from "@/components/ui/skeleton";

function GpuCardSkeleton() {
  return (
    <div className="p-3 rounded-none border space-y-3">
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

function InstanceCardSkeleton() {
  return (
    <div className="p-4 border rounded-none space-y-4">
      {/* Header */}
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
      {/* Specs */}
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

export function GpuSelectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-28" />
      <div className="space-y-4 pr-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <GpuCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function GpuAvailabilitySkeleton() {
  return (
    <div className="space-y-4">
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
  );
}

export default function NewRunLoading() {
  return (
    <div className="space-y-6">
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
        <GpuSelectionSkeleton />
        <div className="flex-1">
          <GpuAvailabilitySkeleton />
        </div>
      </div>
    </div>
  );
}
