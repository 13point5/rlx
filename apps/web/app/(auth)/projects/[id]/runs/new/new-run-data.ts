import { getGpuSummary, getGpuAvailability } from "@/app/actions/api";
import { QueryClient, dehydrate } from "@tanstack/react-query";

interface SearchParams {
  gpu?: string;
  count?: string;
}

export async function getNewRunData(searchParams: SearchParams) {
  const queryClient = new QueryClient();
  const hasUrlParams = Boolean(searchParams.gpu && searchParams.count);

  // When URL has both params, fetch summary and availability in parallel
  if (hasUrlParams) {
    const [summaryResult] = await Promise.all([
      getGpuSummary(),
      queryClient.prefetchInfiniteQuery({
        queryKey: ["gpu-availability", searchParams.gpu, searchParams.count],
        queryFn: async ({ pageParam }) => {
          const result = await getGpuAvailability({
            gpu_type: searchParams.gpu!,
            gpu_count: parseInt(searchParams.count!, 10),
            page: pageParam,
          });
          if (!result.success) {
            throw new Error(result.error || "Failed to fetch GPU availability");
          }
          return result.data;
        },
        initialPageParam: 1,
      }),
    ]);

    console.log("summaryResult", summaryResult);

    return {
      summaryResult,
      selectedGpu: searchParams.gpu,
      selectedCount: searchParams.count,
      state: dehydrate(queryClient),
    };
  }

  // No URL params: fetch summary first to get defaults, then availability
  const summaryResult = await getGpuSummary();

  let selectedGpu: string | undefined;
  let selectedCount: string | undefined;

  if (summaryResult.success && summaryResult.data) {
    const entries = Object.entries(summaryResult.data);
    if (entries.length > 0) {
      selectedGpu = entries[0][0];
      const firstGpuCounts = entries[0][1] as Record<string, unknown>;
      selectedCount = Object.entries(firstGpuCounts).filter(
        ([, value]) => typeof value === "object"
      )[0]?.[0];
    }
  }

  if (selectedGpu && selectedCount) {
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["gpu-availability", selectedGpu, selectedCount],
      queryFn: async ({ pageParam }) => {
        const result = await getGpuAvailability({
          gpu_type: selectedGpu!,
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
