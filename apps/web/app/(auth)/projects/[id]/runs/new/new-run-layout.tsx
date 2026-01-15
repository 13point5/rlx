"use client";

import { useState } from "react";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import { GpuAvailability } from "@/components/gpu-availability";
import { GpuSelection } from "@/components/gpu-selection";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import type { GpuSummaryData } from "@/lib/types";
import { RunFields } from "./run-fields";

interface SummaryResult {
  success: boolean;
  data?: GpuSummaryData;
  error?: string | null;
}

interface NewRunLayoutProps {
  summaryResult: SummaryResult;
  selectedGpu?: string;
  selectedCount?: string;
  state: DehydratedState;
}

export function NewRunLayout({
  summaryResult,
  selectedGpu,
  selectedCount,
  state,
}: NewRunLayoutProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [selectionState, setSelectionState] = useState<{
    key: string;
    id: string;
  } | null>(null);
  const selectionKey = `${selectedGpu ?? ""}:${selectedCount ?? ""}`;
  const selectedInstanceId =
    selectionState && selectionState.key === selectionKey ? selectionState.id : null;

  const handleSelectInstance = (instanceId: string) => {
    setSelectionState({ key: selectionKey, id: instanceId });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={state}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <PageHeading className="whitespace-nowrap">New Run</PageHeading>
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-end">
              <RunFields className="lg:w-auto" />
              <Button className="w-full lg:w-auto" disabled={!selectedInstanceId}>
                Start Run
              </Button>
            </div>
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
                Unable to load GPU summary: {summaryResult.error || "unknown error"}
              </p>
            )}

            <div className="flex-1">
              <GpuAvailability
                gpu={selectedGpu}
                count={selectedCount}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={handleSelectInstance}
              />
            </div>
          </div>
        </div>
      </HydrationBoundary>
    </QueryClientProvider>
  );

}
