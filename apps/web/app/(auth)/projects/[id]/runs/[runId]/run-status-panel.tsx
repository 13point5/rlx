"use client";

import { useQuery } from "@tanstack/react-query";
import { getRunStatus } from "@/app/actions/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RunStatusResponse } from "@/lib/types";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["run-status", runId],
    queryFn: async () => {
      const response = await getRunStatus(runId);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch run status");
      }
      return response.status as RunStatusResponse;
    },
    refetchInterval: 5000,
  });

  const status = data?.status ?? initialStatus;
  const sshConnection = data?.ssh_connection ?? null;
  const statusClass = statusStyles[status] ?? statusStyles.PENDING;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Status</CardTitle>
        <Badge variant="outline" className={cn("capitalize", statusClass)}>
          {isLoading ? "Loading" : status.toLowerCase()}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-destructive">
            {(error as Error).message || "Failed to load status"}
          </p>
        )}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">SSH Terminal</p>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
            {sshConnection || "Waiting for SSH access..."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
