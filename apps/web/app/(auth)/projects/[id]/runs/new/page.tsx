import { getGpuSummary } from "@/app/actions/api";
import { GpuSelection } from "@/components/gpu-selection";
import { GpuAvailability } from "@/components/gpu-availability";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewRunPage({ params, searchParams }: Props) {
  const search = await searchParams;

  // Note: Project validation is handled by breadcrumbs
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

  return (
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
  );
}
