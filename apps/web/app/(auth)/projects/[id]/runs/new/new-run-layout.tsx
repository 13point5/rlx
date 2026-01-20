"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { GpuAvailabilitySkeleton, GpuSelectionSkeleton } from "./loading";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import type { GpuInstance } from "@/lib/types";
import type { ComputedGpuSummary } from "@/lib/gpu-utils";
import { computeGpuSummary } from "@/lib/gpu-utils";
import { startRun, getAllGpuAvailability } from "@/app/actions/api";
import { RunFields } from "./run-fields";
import type { GpuDataResult } from "./new-run-data";

const GpuSelection = dynamic(
  () =>
    import("@/components/gpu-selection").then((mod) => ({
      default: mod.GpuSelection,
    })),
  { loading: () => <GpuSelectionSkeleton /> }
);

const GpuAvailability = dynamic(
  () =>
    import("@/components/gpu-availability").then((mod) => ({
      default: mod.GpuAvailability,
    })),
  { loading: () => <GpuAvailabilitySkeleton />, ssr: false }
);

interface NewRunLayoutProps {
  projectId: number;
  gpuDataResult: GpuDataResult;
  selectedGpu?: string;
  selectedCount?: string;
}

type SelectedInstanceState = {
  key: string;
  instance: GpuInstance & { instanceId: string };
};

export function NewRunLayout({
  projectId,
  gpuDataResult: initialGpuDataResult,
  selectedGpu: initialSelectedGpu,
  selectedCount: initialSelectedCount,
}: NewRunLayoutProps) {
  const router = useRouter();
  const [isStarting, startTransition] = useTransition();
  const [isRefreshing, refreshTransition] = useTransition();
  
  // GPU data state (can be refreshed)
  const [gpuData, setGpuData] = useState<{
    summary: ComputedGpuSummary | undefined;
    instances: GpuInstance[] | undefined;
    error: string | null;
  }>({
    summary: initialGpuDataResult.summary,
    instances: initialGpuDataResult.instances,
    error: initialGpuDataResult.success ? null : (initialGpuDataResult.error ?? "Unknown error"),
  });

  // Selection state
  const [selectedGpu, setSelectedGpu] = useState(initialSelectedGpu);
  const [selectedCount, setSelectedCount] = useState(initialSelectedCount);
  const [selectionState, setSelectionState] = useState<SelectedInstanceState | null>(null);
  
  // Form state
  const [runName, setRunName] = useState("");
  const [branch, setBranch] = useState("main");
  const [config, setConfig] = useState("configs/ppo.yaml");
  const [error, setError] = useState<string | null>(null);

  // Filter instances client-side based on selection (instant, no refetch!)
  const filteredInstances = useMemo(() => {
    if (!gpuData.instances || !selectedGpu || !selectedCount) return [];
    
    return gpuData.instances.filter(
      (instance) =>
        instance.gpuType === selectedGpu &&
        instance.gpuCount === parseInt(selectedCount, 10)
    );
  }, [gpuData.instances, selectedGpu, selectedCount]);

  const selectionKey = `${selectedGpu ?? ""}:${selectedCount ?? ""}`;
  const selectedInstance =
    selectionState && selectionState.key === selectionKey
      ? selectionState.instance
      : null;

  const handleSelectInstance = (
    instance: GpuInstance & { instanceId: string }
  ) => {
    setSelectionState({ key: selectionKey, instance });
  };

  const handleSelectionChange = (gpu: string, count: string) => {
    setSelectedGpu(gpu);
    setSelectedCount(count);
    // Clear selected instance when GPU/count changes
    setSelectionState(null);
    // Update URL without navigation
    router.replace(`?gpu=${gpu}&count=${count}`, { scroll: false });
  };

  const handleRefresh = () => {
    refreshTransition(async () => {
      const result = await getAllGpuAvailability();
      if (result.success && result.data) {
        const newSummary = computeGpuSummary(result.data);
        setGpuData({
          summary: newSummary,
          instances: result.data,
          error: null,
        });
      } else {
        setGpuData((prev) => ({
          ...prev,
          error: result.error ?? "Failed to refresh",
        }));
      }
    });
  };

  const handleStartRun = () => {
    if (!selectedInstance) return;
    setError(null);

    startTransition(async () => {
      const result = await startRun({
        projectId,
        name: runName || "New run",
        branch,
        config,
        instance: selectedInstance,
      });

      if (!result.success || !result.runId) {
        setError(result.error ?? "Failed to start run");
        return;
      }

      router.push(`/projects/${projectId}/runs/${result.runId}`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <PageHeading>New Run</PageHeading>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end">
          <RunFields
            runName={runName}
            branch={branch}
            config={config}
            onRunNameChange={setRunName}
            onBranchChange={setBranch}
            onConfigChange={setConfig}
            className="lg:flex-1"
          />
          <div className="flex flex-col gap-2 lg:w-[140px]">
            <Button
              className="w-full md:w-auto"
              disabled={!selectedInstance || isStarting}
              onClick={handleStartRun}
            >
              {isStarting ? "Starting..." : "Start Run"}
            </Button>
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row w-full">
        {gpuData.summary ? (
          <GpuSelection
            summary={gpuData.summary}
            selectedGpu={selectedGpu}
            selectedCount={selectedCount}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Unable to load GPU summary: {gpuData.error || "unknown error"}
          </p>
        )}

        <div className="flex-1">
          <GpuAvailability
            instances={filteredInstances}
            gpu={selectedGpu}
            count={selectedCount}
            selectedInstanceId={selectedInstance?.instanceId ?? null}
            onSelectInstance={handleSelectInstance}
            isLoading={isRefreshing}
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </div>
  );
}
