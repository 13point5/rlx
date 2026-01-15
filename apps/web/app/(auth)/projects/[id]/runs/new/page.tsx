import { GpuSelection } from "@/components/gpu-selection";
import { GpuAvailability } from "@/components/gpu-availability";
import { PageHeading } from "@/components/page-heading";
import { RunFields } from "./run-fields";
import { getNewRunData } from "./new-run-data";
import { HydrationBoundary } from "@tanstack/react-query";

interface NewRunPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gpu?: string; count?: string }>;
}

export default async function NewRunPage({ searchParams }: NewRunPageProps) {
  const search = await searchParams;
  const { summaryResult, selectedGpu, selectedCount, state } = await getNewRunData(search);

  return (
    <HydrationBoundary state={state}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeading>New Run</PageHeading>
          <RunFields className="lg:w-auto" />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row w-full">
          {summaryResult.success && summaryResult.data ? (
            <GpuSelection
              summary={summaryResult.data}
              selectedGpu={selectedGpu}
              selectedCount={selectedCount}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Unable to load GPU summary:{" "}
              {summaryResult.error || "unknown error"}
            </p>
          )}

          <div className="flex-1">
            <GpuAvailability gpu={selectedGpu} count={selectedCount} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
