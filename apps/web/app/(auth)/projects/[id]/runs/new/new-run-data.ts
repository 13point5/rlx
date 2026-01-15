import { getGpuSummary, getGpuAvailability } from "@/app/actions/api";
import { QueryClient, dehydrate } from "@tanstack/react-query";

interface SearchParams {
  gpu?: string;
  count?: string;
}

export async function getNewRunData(searchParams: SearchParams) {
  const summaryResult = await getGpuSummary();

  let selectedGpu = searchParams.gpu;
  let selectedCount = searchParams.count;

  if (!selectedGpu && summaryResult.success && summaryResult.data) {
    const entries = Object.entries(summaryResult.data);
    if (entries.length > 0) {
      selectedGpu = entries[0][0];
      const firstGpuCounts = entries[0][1] as Record<string, unknown>;
      selectedCount = Object.entries(firstGpuCounts).filter(
        ([, value]) => typeof value === "object"
      )[0]?.[0];
    }
  }

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

  return {
    summaryResult,
    selectedGpu,
    selectedCount,
    state: dehydrate(queryClient),
  };
}
