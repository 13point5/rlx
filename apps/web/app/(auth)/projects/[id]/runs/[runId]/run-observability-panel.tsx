"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getRunLog, getRunObservability } from "@/app/actions/api";
import { TerminalOutput } from "@/components/terminal-output";
import { Card, CardContent } from "@/components/ui/card";
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
      const status = (query.state.data as RunObservabilityResponse | undefined)
        ?.status;
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

  return (
    <Card size="sm" className="min-w-0">
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div className="border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {streams.length === 0 ? (
          <div className="border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            Prime RL observability streams will appear here once the launch job
            starts.
          </div>
        ) : (
          <Tabs
            value={activeSource ?? undefined}
            onValueChange={(value) => setSelectedSource(value as RunLogSource)}
            className="min-w-0"
          >
            <TabsList className="h-auto max-w-full justify-start self-start overflow-x-auto">
              {streams.map((stream) => (
                <TabsTrigger
                  key={stream.source}
                  value={stream.source}
                  className="flex-none px-3"
                >
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
              const isEmpty =
                isActive &&
                !streamLoading &&
                !streamError &&
                streamText.length === 0;

              return (
                <TabsContent key={stream.source} value={stream.source}>
                  <div className="min-w-0 border border-border bg-background">
                    {streamError && (
                      <div className="border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {(streamError as Error).message}
                      </div>
                    )}

                    {(isLoading || streamLoading) && (
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Loading {stream.display_name.toLowerCase()} logs...
                      </div>
                    )}

                    {isEmpty && (
                      <div className="px-4 py-10 text-sm text-muted-foreground">
                        {TERMINAL_STREAM_STATUSES.has(streamStatus)
                          ? "No output was captured for this stream."
                          : `Waiting for ${stream.display_name.toLowerCase()} output...`}
                      </div>
                    )}

                    {streamText && (
                      <TerminalOutput
                        text={streamText}
                        className="min-h-[520px] max-h-[72vh] rounded-none border-0 p-3"
                      />
                    )}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
