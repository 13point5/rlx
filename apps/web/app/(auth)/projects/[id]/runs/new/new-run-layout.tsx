"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { GpuAvailabilitySkeleton, GpuSelectionSkeleton } from "./loading";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import type { GpuInstance, RlxConfigEntry } from "@/lib/types";
import type { ComputedGpuSummary } from "@/lib/gpu-utils";
import { computeGpuSummary } from "@/lib/gpu-utils";
import {
  startRun,
  getAllGpuAvailability,
  getProjectBranches,
  getProjectRlxConfig,
} from "@/app/actions/api";
import { RunFields } from "./run-fields";
import type { ConfigsState } from "./run-fields";
import type { GpuDataResult, BranchesDataResult } from "./new-run-data";

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
  branchesDataResult: BranchesDataResult;
  repoOwner: string;
  repoName: string;
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
  branchesDataResult: initialBranchesDataResult,
  repoOwner,
  repoName,
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
    error: initialGpuDataResult.success
      ? null
      : (initialGpuDataResult.error ?? "Unknown error"),
  });

  // Selection state
  const [selectedGpu, setSelectedGpu] = useState(initialSelectedGpu);
  const [selectedCount, setSelectedCount] = useState(initialSelectedCount);
  const [selectionState, setSelectionState] =
    useState<SelectedInstanceState | null>(null);

  // Compute initial default branch from server-fetched data
  const initialDefaultBranch = (() => {
    if (
      initialBranchesDataResult.success &&
      initialBranchesDataResult.branches.length > 0
    ) {
      const defaultBranchName = initialBranchesDataResult.branches.includes(
        "main"
      )
        ? "main"
        : initialBranchesDataResult.branches[0];
      return `origin/${defaultBranchName}`;
    }
    return "origin/main"; // Fallback
  })();

  // Form state
  const [runName, setRunName] = useState("");
  const [branch, setBranch] = useState(initialDefaultBranch);
  const [selectedConfig, setSelectedConfig] = useState<RlxConfigEntry | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Branches state - initialized from server-fetched data
  const [branchesState, setBranchesState] = useState<{
    branches: string[];
    page: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
  }>({
    branches: initialBranchesDataResult.branches,
    page: 1,
    hasMore: initialBranchesDataResult.hasMore,
    isLoading: false,
    isLoadingMore: false,
    error: initialBranchesDataResult.success
      ? null
      : (initialBranchesDataResult.error ?? "Failed to load branches"),
  });

  // Configs state - fetched when branch changes
  const [configsState, setConfigsState] = useState<ConfigsState>({
    configs: [],
    found: false,
    isLoading: true,
    error: null,
  });

  // Fetch more branches (for pagination only, initial data comes from server)
  const fetchMoreBranches = useCallback(
    async (pageNum: number) => {
      const result = await getProjectBranches({
        projectId,
        page: pageNum,
        per_page: 100,
      });

      if (!result.success || !result.data) {
        setBranchesState((prev) => ({
          ...prev,
          isLoadingMore: false,
          error: result.error ?? "Failed to load more branches",
        }));
        return;
      }

      setBranchesState((prev) => ({
        ...prev,
        branches: [...prev.branches, ...result.data!.branches],
        page: pageNum,
        hasMore: result.data!.has_more,
        isLoadingMore: false,
        error: null,
      }));
    },
    [projectId]
  );

  const handleLoadMoreBranches = useCallback(() => {
    setBranchesState((prev) => ({ ...prev, isLoadingMore: true }));
    fetchMoreBranches(branchesState.page + 1);
  }, [fetchMoreBranches, branchesState.page]);

  // Fetch configs when branch changes
  const fetchConfigs = useCallback(
    async (branchName: string) => {
      setConfigsState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Strip "origin/" prefix for API call
      const cleanBranch = branchName.startsWith("origin/")
        ? branchName.slice(7)
        : branchName;

      const result = await getProjectRlxConfig({
        projectId,
        branch: cleanBranch,
      });

      if (!result.success || !result.data) {
        setConfigsState({
          configs: [],
          found: false,
          isLoading: false,
          error: result.error ?? "Failed to load configs",
        });
        return;
      }

      setConfigsState({
        configs: result.data.configs,
        found: result.data.found,
        isLoading: false,
        error: null,
      });

      // Auto-select first config if available
      if (result.data.configs.length > 0) {
        setSelectedConfig(result.data.configs[0]);
      } else {
        setSelectedConfig(null);
      }
    },
    [projectId]
  );

  // Fetch configs on initial mount and when branch changes
  useEffect(() => {
    fetchConfigs(branch);
  }, [branch, fetchConfigs]);

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
    if (!selectedInstance || !selectedConfig) return;
    setError(null);

    startTransition(async () => {
      const result = await startRun({
        projectId,
        name: runName || "New run",
        branch,
        configName: selectedConfig.name,
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
            selectedConfig={selectedConfig}
            branchesState={branchesState}
            configsState={configsState}
            repoOwner={repoOwner}
            repoName={repoName}
            onRunNameChange={setRunName}
            onBranchChange={setBranch}
            onConfigChange={setSelectedConfig}
            onLoadMoreBranches={handleLoadMoreBranches}
            className="lg:flex-1"
          />
          <div className="flex flex-col gap-2 lg:w-[140px]">
            <Button
              className="w-full md:w-auto"
              disabled={!selectedInstance || !selectedConfig || isStarting}
              onClick={handleStartRun}
            >
              {isStarting ? "Starting..." : "Start Run"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
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
