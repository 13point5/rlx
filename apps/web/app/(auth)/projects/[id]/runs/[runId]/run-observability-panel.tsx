"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { getRunLog, getRunObservability } from "@/app/actions/api";
import { TerminalOutput } from "@/components/terminal-output";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RunLogResponse,
  RunLogSource,
  RunLogStreamSummary,
  RunObservabilityResponse,
} from "@/lib/types";

interface RunObservabilityPanelProps {
  runId: number;
  initialRunStatus: string;
}

const TERMINAL_RUN_STATUSES = new Set(["TERMINATED", "STOPPED", "ERROR"]);
const TERMINAL_STREAM_STATUSES = new Set(["COMPLETE", "ERROR"]);

export function RunObservabilityPanel({
  runId,
  initialRunStatus,
}: RunObservabilityPanelProps) {
  const [selectedSource, setSelectedSource] = useState<RunLogSource | null>(null);

  const {
    data: observability,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["run-observability", runId],
    queryFn: async () => {
      const response = await getRunObservability(runId);
      if (!response.success || !response.observability) {
        throw new Error(response.error || "Failed to fetch run observability");
      }
      return response.observability as RunObservabilityResponse;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as RunObservabilityResponse | undefined)?.status;
      return TERMINAL_RUN_STATUSES.has(status ?? initialRunStatus) ? false : 5000;
    },
  });

  const streams = observability?.streams ?? [];
  const availableSources = streams.map((stream) => stream.source);
  const activeSource =
    selectedSource && availableSources.includes(selectedSource)
      ? selectedSource
      : observability?.default_source ?? availableSources[0] ?? null;

  const activeStream =
    streams.find((stream) => stream.source === activeSource) ?? null;

  const {
    data: activeLog,
    isLoading: isLoadingLog,
    error: activeLogError,
  } = useQuery({
    queryKey: ["run-log", runId, activeSource],
    queryFn: async () => {
      if (!activeSource) {
        return null;
      }

      const response = await getRunLog(runId, activeSource);
      if (!response.success || !response.log) {
        throw new Error(response.error || "Failed to fetch run log");
      }
      return response.log as RunLogResponse;
    },
    enabled: Boolean(activeSource),
    refetchInterval: (query) => {
      if (!activeSource) {
        return false;
      }

      const runStatus = observability?.status ?? initialRunStatus;
      if (TERMINAL_RUN_STATUSES.has(runStatus)) {
        return false;
      }

      const streamStatus =
        (query.state.data as RunLogResponse | null | undefined)?.status ??
        activeStream?.status;
      if (streamStatus && TERMINAL_STREAM_STATUSES.has(streamStatus)) {
        return false;
      }

      return 5000;
    },
  });

  const activeText =
    activeLog?.chunks.map((chunk) => chunk.content).join("") ?? "";
  const activeStatus = activeLog?.status ?? activeStream?.status ?? "ACTIVE";
  const activeUpdatedAt = activeStream?.updated_at
    ? new Date(activeStream.updated_at).toLocaleTimeString()
    : null;

  const orchestratorWandbUrl = observability?.wandb.orchestrator?.url;
  const trainerWandbUrl = observability?.wandb.trainer?.url;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Observability</CardTitle>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {orchestratorWandbUrl ? (
              <Button asChild size="sm" variant="outline">
                <a
                  href={orchestratorWandbUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Orchestrator Run
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                <ExternalLink className="h-3 w-3" />
                Open Orchestrator Run
              </Button>
            )}
            {trainerWandbUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={trainerWandbUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Open Trainer Run
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                <ExternalLink className="h-3 w-3" />
                Open Trainer Run
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {streams.length === 0 ? (
          <div className="rounded-none border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            Prime RL observability streams will appear here once the launch job starts.
          </div>
        ) : (
          <Tabs
            value={activeSource ?? undefined}
            onValueChange={(value) => setSelectedSource(value as RunLogSource)}
          >
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              {streams.map((stream) => (
                <TabsTrigger key={stream.source} value={stream.source}>
                  {stream.display_name}
                </TabsTrigger>
              ))}
            </TabsList>

            {streams.map((stream: RunLogStreamSummary) => {
              const isActive = stream.source === activeSource;
              const streamText = isActive ? activeText : "";
              const streamError = isActive ? activeLogError : null;
              const streamLoading = isActive ? isLoadingLog : false;
              const streamStatus = isActive ? activeStatus : stream.status;
              const isEmpty = isActive && !streamLoading && !streamError && streamText.length === 0;

              return (
                <TabsContent key={stream.source} value={stream.source} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Status: {streamStatus}</span>
                    {isActive && activeUpdatedAt && <span>Updated {activeUpdatedAt}</span>}
                  </div>

                  {streamError && (
                    <div className="text-sm text-destructive">
                      {(streamError as Error).message}
                    </div>
                  )}

                  {streamLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading {stream.display_name.toLowerCase()} logs...
                    </div>
                  )}

                  {isEmpty && (
                    <div className="rounded-none border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                      {TERMINAL_STREAM_STATUSES.has(streamStatus)
                        ? "No output was captured for this stream."
                        : `Waiting for ${stream.display_name.toLowerCase()} output...`}
                    </div>
                  )}

                  {streamText && (
                    <TerminalOutput
                      text={streamText}
                      className="min-h-[320px] max-h-[70vh] rounded-none"
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
