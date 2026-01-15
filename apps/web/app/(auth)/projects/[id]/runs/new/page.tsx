import { getGpuSummary, getGpuAvailability } from "@/app/actions/api";
import { GpuSelection } from "@/components/gpu-selection";
import { GpuAvailability } from "@/components/gpu-availability";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewRunPage({ searchParams }: Props) {
  const search = await searchParams;

  // Fetch GPU summary first to determine defaults
  const summaryResult = await getGpuSummary();

  // Get selected GPU from URL or use first available as default
  let selectedGpu = typeof search.gpu === "string" ? search.gpu : undefined;
  let selectedCount = typeof search.count === "string" ? search.count : undefined;

  // If no GPU selected, use first available as default (no redirect)
  if (!selectedGpu && summaryResult.success && summaryResult.data) {
    const entries = Object.entries(summaryResult.data);
    if (entries.length > 0) {
      selectedGpu = entries[0][0];
      const firstGpuCounts = entries[0][1] as Record<string, unknown>;
      selectedCount = Object.entries(firstGpuCounts).filter(
        ([, v]) => typeof v === "object"
      )[0]?.[0];
    }
  }

  // Prefetch GPU availability data for React Query hydration
  const queryClient = new QueryClient();

  if (selectedGpu && selectedCount) {
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["gpu-availability", selectedGpu, selectedCount],
      queryFn: async ({ pageParam }) => {
        const result = await getGpuAvailability({
          gpu_type: selectedGpu,
          gpu_count: parseInt(selectedCount!, 10),
          page: pageParam,
        });
        if (!result.success) {
          throw new Error(result.error || "Failed to fetch GPU availability");
        }
        return result.data;
      },
      initialPageParam: 1,
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">New Run</h1>

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
