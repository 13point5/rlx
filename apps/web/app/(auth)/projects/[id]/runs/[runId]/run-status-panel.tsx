"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getRunStatus, terminateRun } from "@/app/actions/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  RunRecord,
  RunStatusErrorPayload,
  RunStatusResponse,
} from "@/lib/types";

interface RunStatusPanelProps {
  runId: number;
  initialStatus: string;
  run: RunRecord;
  className?: string;
}

const statusStyles: Record<string, string> = {
  ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  PROVISIONING: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  ERROR: "border-destructive/20 bg-destructive/10 text-destructive",
  STOPPED: "border-muted-foreground/20 bg-muted text-muted-foreground",
  TERMINATED: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

function formatStatusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unavailable";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationBetween(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined
) {
  if (!startedAt) {
    return "Unavailable";
  }

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "Unavailable";
  }

  const totalSeconds = Math.round((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getStatusErrorPayload(error: Error | null) {
  if (!error) {
    return null;
  }

  try {
    const parsed = JSON.parse(error.message) as RunStatusErrorPayload;
    if (parsed?.message && parsed?.last_known_status) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function OverviewMetric({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-base font-medium text-foreground break-words",
          mono && "font-mono text-xs font-normal break-all"
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function OverviewDetail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-sm leading-6 text-foreground break-words",
          mono ? "font-mono text-[13px] break-all" : "font-medium"
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

export function RunStatusPanel({
  runId,
  initialStatus,
  run,
  className,
}: RunStatusPanelProps) {
  const queryClient = useQueryClient();
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [isTerminating, startTerminate] = useTransition();

  const { data, error } = useQuery({
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
      const currentStatus = (query.state.data as RunStatusResponse | undefined)
        ?.status;
      if (currentStatus === "TERMINATED") {
        return false;
      }

      if (query.state.error) {
        try {
          const parsed = JSON.parse(
            (query.state.error as Error).message
          ) as RunStatusErrorPayload;
          if (parsed?.last_known_status === "TERMINATED") {
            return false;
          }
        } catch {
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
  const statusClass = statusStyles[status] ?? statusStyles.PENDING;
  const sshConnection = data?.ssh_connection ?? null;
  const ipAddress = data?.ip ?? null;
  const sshMessage = sshConnection
    ? sshConnection
    : status === "TERMINATED"
      ? "Instance terminated"
      : "Waiting for SSH access...";
  const isTerminated = status === "TERMINATED";

  const errorPayload = getStatusErrorPayload(error as Error | null);
  const errorMessage =
    errorPayload?.message || (error as Error | null)?.message || terminateError;
  const lastKnownStatus = errorPayload?.last_known_status;
  const lastUpdatedAt = errorPayload?.last_updated_at;
  const durationLabel = formatDurationBetween(run.created_at, run.updated_at);

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

  return (
    <Card size="sm" className={className}>
      <CardHeader className="gap-4 border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CardTitle>Overview</CardTitle>
            <Badge
              variant="outline"
              className={cn("border px-2 py-0.5 capitalize", statusClass)}
            >
              {formatStatusLabel(status)}
            </Badge>
          </div>

          <Button
            size="sm"
            variant="destructive"
            disabled={isTerminated || isTerminating}
            onClick={handleTerminate}
          >
            {isTerminating ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {isTerminating ? "Terminating..." : "Terminate"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <OverviewMetric label="Duration" value={durationLabel} />
          <OverviewMetric
            label="GPU"
            value={`${run.gpu_type} x${run.gpu_count}`}
          />
          <OverviewMetric label="Created" value={formatDateTime(run.created_at)} />
          <OverviewMetric label="Updated" value={formatDateTime(run.updated_at)} />
        </div>

        <div className="flex flex-col gap-1">
          <Separator />

          <Accordion
            type="multiple"
            defaultValue={["source", "compute", "access"]}
            className="w-full"
          >
            <AccordionItem value="source">
              <AccordionTrigger className="py-2 text-base font-medium text-foreground hover:no-underline">
                Source
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <div className="flex flex-col gap-4">
                  <OverviewDetail label="Branch" value={run.branch} />
                  <OverviewDetail label="Config" value={run.config_name} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="compute">
              <AccordionTrigger className="py-2 text-base font-medium text-foreground hover:no-underline">
                Compute
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <div className="flex flex-col gap-4">
                  <OverviewDetail label="Provider" value={run.provider} />
                  <OverviewDetail label="Region" value={run.region} />
                  {run.data_center ? (
                    <OverviewDetail label="Zone" value={run.data_center} />
                  ) : null}
                  <OverviewDetail
                    label="Security"
                    value={`${run.security}${run.is_spot ? " · spot" : ""}`}
                  />
                  <OverviewDetail label="Cloud ID" value={run.cloud_id} mono />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="access">
              <AccordionTrigger className="py-2 text-base font-medium text-foreground hover:no-underline">
                Access
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <div className="flex flex-col gap-4">
                  <OverviewDetail label="SSH" value={sshMessage} mono />
                  <OverviewDetail
                    label="IP"
                    value={ipAddress ?? (isTerminated ? "Unavailable" : "Pending")}
                    mono
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {(errorMessage || lastKnownStatus) && (
          <div className="flex flex-col gap-1 border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage && <p>{errorMessage}</p>}
            {lastKnownStatus && (
              <p className="text-xs text-muted-foreground">
                Last known status: {formatStatusLabel(lastKnownStatus)} at{" "}
                {formatDateTime(lastUpdatedAt)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
