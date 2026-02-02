"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { getJobLogs, refreshJobLogs } from "@/app/actions/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { JobLogEntry, LogType } from "@/lib/types";

interface TrainingLogsPanelProps {
  jobId: number;
  jobStatus: string;
}

const LOG_TYPES: { value: LogType; label: string }[] = [
  { value: "trainer", label: "Trainer" },
  { value: "orchestrator", label: "Orchestrator" },
  { value: "inference", label: "Inference" },
  { value: "rl", label: "RL" },
];

function LogViewer({
  logs,
  isLoading,
  autoScroll,
}: {
  logs: JobLogEntry[];
  isLoading: boolean;
  autoScroll: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading logs...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No logs available yet
      </div>
    );
  }

  // Combine all log chunks into a single string
  const combinedLogs = logs.map((log) => log.content).join("");

  return (
    <div
      ref={containerRef}
      className="bg-zinc-950 rounded-md p-3 font-mono text-xs overflow-auto h-[400px] whitespace-pre-wrap text-zinc-300"
    >
      {combinedLogs}
    </div>
  );
}

export function TrainingLogsPanel({ jobId, jobStatus }: TrainingLogsPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LogType>("trainer");
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastLogId, setLastLogId] = useState<Record<LogType, number>>({
    trainer: 0,
    orchestrator: 0,
    inference: 0,
    rl: 0,
  });

  const isRunning = jobStatus === "RUNNING" || jobStatus === "QUEUED";

  // Fetch logs for the active tab
  const {
    data: logsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["job-logs", jobId, activeTab],
    queryFn: async () => {
      const response = await getJobLogs(jobId, {
        logType: activeTab,
        limit: 500,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch logs");
      }
      return response.data;
    },
    refetchInterval: isRunning ? 3000 : false,
  });

  // Update last log ID when we get new logs
  useEffect(() => {
    if (logsData?.logs && logsData.logs.length > 0) {
      const lastId = logsData.logs[logsData.logs.length - 1].id;
      setLastLogId((prev) => ({
        ...prev,
        [activeTab]: lastId,
      }));
    }
  }, [logsData, activeTab]);

  // Manual refresh handler
  const handleRefresh = async () => {
    await refreshJobLogs(jobId);
    // Wait a bit for the task to fetch logs, then refetch
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["job-logs", jobId] });
    }, 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Training Logs</h4>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-7 px-2 text-xs", autoScroll && "bg-muted")}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            Auto-scroll
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LogType)}>
        <TabsList className="h-8">
          {LOG_TYPES.map((logType) => (
            <TabsTrigger
              key={logType.value}
              value={logType.value}
              className="text-xs px-3 h-7"
            >
              {logType.label}
              {logsData?.offsets?.[logType.value] ? (
                <span className="ml-1 text-muted-foreground">
                  ({Math.round(logsData.offsets[logType.value] / 1024)}KB)
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {LOG_TYPES.map((logType) => (
          <TabsContent key={logType.value} value={logType.value} className="mt-2">
            {error ? (
              <div className="text-destructive text-xs p-3 bg-destructive/10 rounded">
                {(error as Error).message}
              </div>
            ) : (
              <LogViewer
                logs={logsData?.logs ?? []}
                isLoading={isLoading}
                autoScroll={autoScroll}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {isRunning && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Streaming logs...</span>
        </div>
      )}
    </div>
  );
}
