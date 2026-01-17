"use client";

import { useState, useTransition } from "react";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { GpuAvailability } from "@/components/gpu-availability";
import { GpuSelection } from "@/components/gpu-selection";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import type { GpuInstance, GpuSummaryData } from "@/lib/types";
import { startRun } from "@/app/actions/api";
import { RunFields } from "./run-fields";

interface SummaryResult {
  success: boolean;
  data?: GpuSummaryData;
  error?: string | null;
}

interface NewRunLayoutProps {
  projectId: number;
  summaryResult: SummaryResult;
  selectedGpu?: string;
  selectedCount?: string;
  state: DehydratedState;
}

type SelectedInstanceState = {
  key: string;
  instance: GpuInstance & { instanceId: string };
};

export function NewRunLayout({
  projectId,
  summaryResult,
  selectedGpu,
  selectedCount,
  state,
}: NewRunLayoutProps) {
  const router = useRouter();
  const [queryClient] = useState(() => new QueryClient());
  const [isStarting, startTransition] = useTransition();
  const [selectionState, setSelectionState] =
    useState<SelectedInstanceState | null>(null);
  const selectionKey = `${selectedGpu ?? ""}:${selectedCount ?? ""}`;
  const [optimisticSelectionKey, setOptimisticSelectionKey] =
    useState(selectionKey);
  const selectedInstance =
    selectionState && selectionState.key === selectionKey
      ? selectionState.instance
      : null;
  const isSelectionPending = optimisticSelectionKey !== selectionKey;
  const effectiveSelectedInstance = isSelectionPending
    ? null
    : selectedInstance;
  const [runName, setRunName] = useState("");
  const [branch, setBranch] = useState("main");
  const [config, setConfig] = useState("configs/ppo.yaml");
  const [error, setError] = useState<string | null>(null);

  const handleSelectInstance = (
    instance: GpuInstance & { instanceId: string }
  ) => {
    setSelectionState({ key: selectionKey, instance });
  };

  const handleSelectionChange = (gpu: string, count: string) => {
    setOptimisticSelectionKey(`${gpu}:${count}`);
  };

  const handleStartRun = () => {
    if (!effectiveSelectedInstance) return;
    setError(null);

    startTransition(async () => {
      const result = await startRun({
        projectId,
        name: runName || "New run",
        branch,
        config,
        instance: effectiveSelectedInstance,
      });

      if (!result.success || !result.runId) {
        setError(result.error ?? "Failed to start run");
        return;
      }

      router.push(`/projects/${projectId}/runs/${result.runId}`);
    });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={state}>
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
                  disabled={!effectiveSelectedInstance || isStarting}
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

          <div className="flex flex-col gap-4 lg:flex-row w-full">
            {summaryResult.success && summaryResult.data ? (
              <GpuSelection
                summary={summaryResult.data}
                selectedGpu={selectedGpu}
                selectedCount={selectedCount}
                onSelectionChange={handleSelectionChange}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load GPU summary:{" "}
                {summaryResult.error || "unknown error"}
              </p>
            )}

            <div className="flex-1">
              <GpuAvailability
                gpu={selectedGpu}
                count={selectedCount}
                selectedInstanceId={
                  effectiveSelectedInstance?.instanceId ?? null
                }
                onSelectInstance={handleSelectInstance}
                forceLoading={isSelectionPending}
              />
            </div>
          </div>
        </div>
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
