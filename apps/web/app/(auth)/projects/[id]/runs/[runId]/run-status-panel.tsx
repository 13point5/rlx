"use client";

import { useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRunStatus, terminateRun } from "@/app/actions/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RunStatusErrorPayload, RunStatusResponse } from "@/lib/types";

interface RunStatusPanelProps {
  runId: number;
  initialStatus: string;
}

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-500 border-green-500/20",
  PROVISIONING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  ERROR: "bg-red-500/10 text-red-500 border-red-500/20",
  STOPPED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  TERMINATED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export function RunStatusPanel({ runId, initialStatus }: RunStatusPanelProps) {
  const queryClient = useQueryClient();
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [isTerminating, startTerminate] = useTransition();

  const { data, isLoading, error } = useQuery({
    queryKey: ["run-status", runId],
    queryFn: async () => {
      const response = await getRunStatus(runId);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch run status");
      }
      return response.status as RunStatusResponse;
    },
    enabled: overrideStatus !== "TERMINATED",
    refetchInterval: (query) => {
      const currentStatus = (query.state.data as RunStatusResponse | undefined)?.status;
      if (currentStatus === "TERMINATED") {
        return false;
      }

      if (query.state.error) {
        try {
          const parsed = JSON.parse((query.state.error as Error).message) as RunStatusErrorPayload;
          if (parsed?.last_known_status === "TERMINATED") {
            return false;
          }
        } catch (parseError) {
          return 5000;
        }
      }

      if (initialStatus === "TERMINATED") {
        return false;
      }

      return 5000;
    },
  });

  const status = overrideStatus ?? data?.status ?? initialStatus;
  const sshConnection = data?.ssh_connection ?? null;
  const statusClass = statusStyles[status] ?? statusStyles.PENDING;
  const sshMessage = sshConnection
    ? sshConnection
    : status === "TERMINATED"
      ? "Instance terminated"
      : "Waiting for SSH access...";

  const errorPayload = useMemo<RunStatusErrorPayload | null>(() => {
    if (!error) {
      return null;
    }

    try {
      const parsed = JSON.parse((error as Error).message) as RunStatusErrorPayload;
      if (parsed && parsed.message && parsed.last_known_status) {
        return parsed;
      }
    } catch (parseError) {
      return null;
    }

    return null;
  }, [error]);

  const errorMessage = errorPayload?.message || (error as Error | null)?.message;
  const lastKnownStatus = errorPayload?.last_known_status;
  const lastUpdatedAt = errorPayload?.last_updated_at;

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : "Unknown time";

  const handleTerminate = () => {
    setTerminateError(null);

    startTerminate(async () => {
      const result = await terminateRun(runId);

      if (!result.success || !result.status) {
        setTerminateError(result.error ?? "Failed to terminate run");
        return;
      }

      setOverrideStatus(result.status.status);
      await queryClient.invalidateQueries({ queryKey: ["run-status", runId] });
    });
  };

  const isTerminated = status === "TERMINATED";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CardTitle>Status</CardTitle>
          <Badge variant="outline" className={cn("capitalize", statusClass)}>
            {isLoading ? "Loading" : status.toLowerCase()}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="destructive"
          disabled={isTerminated || isTerminating}
          onClick={handleTerminate}
        >
          {isTerminating ? "Terminating..." : "Terminate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {(errorMessage || terminateError) && (
          <div className="space-y-1 text-sm text-destructive">
            {errorMessage && <p>{errorMessage}</p>}
            {terminateError && <p>{terminateError}</p>}
            {lastKnownStatus && (
              <p className="text-muted-foreground">
                Last known status: {lastKnownStatus} ({lastUpdatedLabel})
              </p>
            )}
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">SSH Terminal</p>
          <div className="rounded-none border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
            {sshMessage}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
