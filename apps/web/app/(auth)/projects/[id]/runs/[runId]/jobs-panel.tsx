"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  getJobDetails,
  getRunJobs,
  getRunStatus,
  retryJob,
  syncRunJobs,
} from "@/app/actions/api";
import { TerminalOutput } from "@/components/terminal-output";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  JobCommand,
  JobDetailResponse,
  JobResponse,
  JobStatus,
  RunStatusResponse,
} from "@/lib/types";

interface JobsPanelProps {
  runId: number;
  runStatus: string;
}

type JobSectionKey = "running" | "queued" | "failed" | "completed";

function isRunActive(runStatus: string) {
  return runStatus === "ACTIVE";
}

function isRunRetryable(runStatus: string) {
  return (
    runStatus !== "TERMINATED" &&
    runStatus !== "STOPPED" &&
    runStatus !== "ERROR"
  );
}

function isJobTerminal(status: JobStatus) {
  return (
    status === "SUCCESS" ||
    status === "FAILED" ||
    status === "TIMEOUT" ||
    status === "CANCELLED"
  );
}

function formatStatusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unavailable";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs === null || durationMs === undefined || Number.isNaN(durationMs)) {
    return null;
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function getDurationFromRange(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined
) {
  if (!startedAt) {
    return null;
  }

  const startTime = new Date(startedAt).getTime();
  const endTime = completedAt ? new Date(completedAt).getTime() : Date.now();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return null;
  }

  return formatDuration(Math.max(endTime - startTime, 0));
}

function getIdleJobMessage(status: JobStatus, runStatus: string) {
  if (status === "PENDING") {
    return isRunActive(runStatus)
      ? "Waiting for earlier jobs to finish."
      : "Pod is still provisioning.";
  }

  if (status === "QUEUED") {
    return "Waiting for a worker.";
  }

  if (status === "RUNNING") {
    return "Fetching live output.";
  }

  return null;
}

function getJobTitle(job: JobResponse) {
  const config = job.config;

  switch (job.job_type) {
    case "CLONE_REPO": {
      const repoUrl = config?.repo_url as string | undefined;
      if (repoUrl) {
        const match = repoUrl.match(/\/([^/]+?)(\.git)?$/);
        const repoName = match?.[1] || repoUrl;
        const targetDir = config?.target_dir as string | undefined;
        return `Clone ${repoName}${targetDir ? ` -> ${targetDir}` : ""}`;
      }
      return "Clone repository";
    }
    case "LIST_FILES": {
      const targetDir = config?.target_dir as string | undefined;
      return targetDir ? `List files in ${targetDir}` : "List files";
    }
    case "CUSTOM_COMMAND": {
      const command = config?.command as string | undefined;
      return command || "Run command";
    }
    default:
      return job.job_type;
  }
}

function getJobSummary(job: JobResponse) {
  const config = job.config;

  switch (job.job_type) {
    case "CLONE_REPO": {
      const repoUrl = config?.repo_url as string | undefined;
      return repoUrl || "Repository checkout";
    }
    case "LIST_FILES": {
      const targetDir = config?.target_dir as string | undefined;
      return targetDir ? `Directory ${targetDir}` : "Repository file listing";
    }
    case "CUSTOM_COMMAND": {
      const workingDir = config?.working_dir as string | undefined;
      return workingDir ? `Working dir ${workingDir}` : "Custom shell command";
    }
    default:
      return formatStatusLabel(job.job_type);
  }
}

function getJobContext(job: JobResponse, runStatus: string) {
  const idleMessage = getIdleJobMessage(job.status, runStatus);
  if (idleMessage) {
    return idleMessage;
  }

  if (job.status === "SUCCESS") {
    return `Completed at ${formatTime(job.completed_at)}`;
  }

  if (
    job.status === "FAILED" ||
    job.status === "TIMEOUT" ||
    job.status === "CANCELLED"
  ) {
    return job.error_type ? `Ended with ${job.error_type}.` : "Needs attention.";
  }

  return formatStatusLabel(job.status);
}

function getJobSection(status: JobStatus): JobSectionKey {
  if (status === "RUNNING") {
    return "running";
  }

  if (status === "PENDING" || status === "QUEUED") {
    return "queued";
  }

  if (status === "SUCCESS") {
    return "completed";
  }

  return "failed";
}

const statusConfig: Record<
  JobStatus,
  { icon: LucideIcon; className: string; label: string }
> = {
  PENDING: {
    icon: Circle,
    className: "text-muted-foreground",
    label: "Pending",
  },
  QUEUED: {
    icon: Clock,
    className: "text-amber-300",
    label: "Queued",
  },
  RUNNING: {
    icon: Loader2,
    className: "text-sky-300",
    label: "Running",
  },
  SUCCESS: {
    icon: CheckCircle2,
    className: "text-emerald-400",
    label: "Success",
  },
  FAILED: {
    icon: XCircle,
    className: "text-destructive",
    label: "Failed",
  },
  TIMEOUT: {
    icon: XCircle,
    className: "text-amber-300",
    label: "Timeout",
  },
  CANCELLED: {
    icon: XCircle,
    className: "text-muted-foreground",
    label: "Cancelled",
  },
};

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status] ?? statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border px-2 py-0.5 font-normal", config.className)}
    >
      <Icon className={cn("size-3.5", status === "RUNNING" && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

function CopyTextButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error);
    }
  }

  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function CommandSection({
  command,
  index,
  totalCommands,
}: {
  command: JobCommand;
  index: number;
  totalCommands: number;
}) {
  const durationLabel =
    formatDuration(command.duration_ms) ||
    getDurationFromRange(command.started_at, command.completed_at);
  const commandLabel = totalCommands > 1 ? `Command ${index + 1}` : "Command";

  return (
    <div className="border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/15 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">{commandLabel}</Badge>
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={command.command}
          >
            $ {command.command}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {durationLabel && (
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {durationLabel}
            </span>
          )}
          {command.exit_code !== null && (
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5",
                command.exit_code === 0 ? "text-emerald-400" : "text-destructive"
              )}
            >
              Exit {command.exit_code}
            </Badge>
          )}
          <CopyTextButton
            text={command.command}
            label={`${commandLabel.toLowerCase()} command`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        {command.working_dir && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Working dir: <span className="font-mono lowercase">{command.working_dir}</span>
          </div>
        )}

        {!command.stdout && !command.stderr && (
          <div className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            {command.status === "RUNNING"
              ? "Command is running. Waiting for the first output..."
              : "No command output was captured."}
          </div>
        )}

        {command.stdout && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Stdout
              </span>
              <CopyTextButton
                text={command.stdout}
                label={`${commandLabel.toLowerCase()} stdout`}
              />
            </div>
            <TerminalOutput text={command.stdout} className="max-h-56 rounded-none" />
          </div>
        )}

        {command.stderr && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-amber-300">
                Stderr
              </span>
              <CopyTextButton
                text={command.stderr}
                label={`${commandLabel.toLowerCase()} stderr`}
              />
            </div>
            <TerminalOutput
              text={command.stderr}
              tone="stderr"
              className="max-h-56 rounded-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function JobItem({
  job,
  runId,
  runStatus,
}: {
  job: JobResponse;
  runId: number;
  runStatus: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const isRunning = job.status === "RUNNING";
  const runIsActive = isRunActive(runStatus);
  const isTerminal = isJobTerminal(job.status);
  const shouldFetchDetails = isRunning || (expanded && isTerminal);

  const { data: jobDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["job-details", job.id],
    queryFn: async () => {
      const response = await getJobDetails(job.id);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch job details");
      }
      return response.job as JobDetailResponse;
    },
    enabled: shouldFetchDetails,
    staleTime: isRunning ? 0 : Number.POSITIVE_INFINITY,
    refetchInterval: isRunning && runIsActive ? 5000 : false,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await retryJob(job.id);
      if (!response.success) {
        throw new Error(response.error || "Failed to retry job");
      }
      return response.job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run-jobs", runId] });
      queryClient.invalidateQueries({ queryKey: ["job-details", job.id] });
    },
  });

  const canRetry =
    isRunRetryable(runStatus) &&
    (job.status === "FAILED" ||
      job.status === "CANCELLED" ||
      job.status === "TIMEOUT");
  const commands = jobDetails?.commands ?? [];
  const hasCommands = commands.length > 0;
  const idleJobMessage = getIdleJobMessage(job.status, runStatus);
  const shouldShowIdleMessage =
    expanded &&
    !isLoadingDetails &&
    !job.error_message &&
    !hasCommands &&
    idleJobMessage !== null;
  const shouldShowNoDetailsMessage =
    expanded &&
    !isLoadingDetails &&
    !job.error_message &&
    !hasCommands &&
    idleJobMessage === null;
  const title = getJobTitle(job);
  const summary = getJobSummary(job);
  const context = getJobContext(job, runStatus);
  const durationLabel = getDurationFromRange(job.started_at, job.completed_at);
  const StatusIcon = statusConfig[job.status]?.icon ?? Circle;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="cursor-pointer px-4 py-3 transition-colors hover:bg-muted/15"
        onClick={() => setExpanded((current) => !current)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_minmax(126px,auto)_minmax(92px,auto)_auto] md:items-center">
          <div className="flex size-5 items-center justify-center">
            <StatusIcon
              className={cn(
                "size-4 text-muted-foreground",
                statusConfig[job.status]?.className,
                job.status === "RUNNING" && "animate-spin"
              )}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                #{job.sequence}
              </span>
              <span className="truncate text-sm font-medium text-foreground" title={title}>
                {title}
              </span>
            </div>

            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{formatStatusLabel(job.job_type)}</span>
              <span className="truncate" title={summary}>
                {summary}
              </span>
              <span className="truncate" title={context}>
                {context}
              </span>
            </div>
          </div>

          <div className="md:justify-self-start">
            <JobStatusBadge status={job.status} />
          </div>

          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground md:text-right">
            {durationLabel ?? formatTime(job.started_at ?? job.created_at)}
          </div>

          <div className="flex items-center justify-end gap-2">
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  retryMutation.mutate();
                }}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                Retry
              </Button>
            )}
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          <div className="ml-8 flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Created {formatDateTime(job.created_at)}</span>
              <span>Started {formatDateTime(job.started_at)}</span>
              <span>Completed {formatDateTime(job.completed_at)}</span>
              {job.celery_task_id && (
                <span className="font-mono">Task {job.celery_task_id}</span>
              )}
              {job.error_type && <span>Error type {job.error_type}</span>}
            </div>

            {isLoadingDetails && shouldFetchDetails && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading job details...
              </div>
            )}

            {isRunning && (
              <div className="text-[11px] uppercase tracking-[0.18em] text-sky-300">
                Live command output refreshes every 5 seconds.
              </div>
            )}

            {job.error_message && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-destructive">
                    Job Error
                  </span>
                  <CopyTextButton text={job.error_message} label="job error" />
                </div>
                <TerminalOutput
                  text={job.error_message}
                  tone="stderr"
                  className="max-h-40 rounded-none"
                />
              </div>
            )}

            {shouldShowIdleMessage && (
              <div className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {idleJobMessage}
              </div>
            )}

            {shouldShowNoDetailsMessage && (
              <div className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No command output was captured for this job.
              </div>
            )}

            {hasCommands && (
              <div className="flex flex-col gap-3">
                {commands.map((command, index) => (
                  <CommandSection
                    key={command.id}
                    command={command}
                    index={index}
                    totalCommands={commands.length}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function JobSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-3 bg-muted/10 px-4 py-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {count}
        </span>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function JobsPanel({ runId, runStatus }: JobsPanelProps) {
  const queryClient = useQueryClient();
  const { data: runStatusData } = useQuery({
    queryKey: ["run-status", runId],
    queryFn: async () => {
      const response = await getRunStatus(runId);
      if (!response.success || !response.status) {
        throw new Error(response.error || "Failed to fetch run status");
      }
      return response.status as RunStatusResponse;
    },
    enabled: runStatus !== "TERMINATED",
    refetchInterval: (query) => {
      const currentStatus =
        (query.state.data as RunStatusResponse | undefined)?.status ?? runStatus;
      return currentStatus === "TERMINATED" ? false : 5000;
    },
  });
  const effectiveRunStatus = runStatusData?.status ?? runStatus;

  const {
    data: jobs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["run-jobs", runId],
    queryFn: async () => {
      const response = await getRunJobs(runId);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch jobs");
      }
      return response.jobs ?? [];
    },
    refetchInterval: (query) => {
      const currentJobs = query.state.data as JobResponse[] | undefined;
      if (!isRunActive(effectiveRunStatus)) {
        return false;
      }
      if (!currentJobs) {
        return 5000;
      }

      const hasActiveJobs = currentJobs.some(
        (job) =>
          job.status === "PENDING" ||
          job.status === "QUEUED" ||
          job.status === "RUNNING"
      );

      return hasActiveJobs ? 5000 : false;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await syncRunJobs(runId);
      if (!response.success) {
        throw new Error(response.error || "Failed to sync jobs");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run-jobs", runId] });
    },
  });

  const sortedJobs =
    jobs?.slice().sort((a, b) => a.sequence - b.sequence) ?? [];
  const sections: Array<{ key: JobSectionKey; title: string; jobs: JobResponse[] }> = [
    {
      key: "running",
      title: "In Progress",
      jobs: sortedJobs.filter((job) => getJobSection(job.status) === "running"),
    },
    {
      key: "queued",
      title: "Queued",
      jobs: sortedJobs.filter((job) => getJobSection(job.status) === "queued"),
    },
    {
      key: "failed",
      title: "Needs Attention",
      jobs: sortedJobs.filter((job) => getJobSection(job.status) === "failed"),
    },
    {
      key: "completed",
      title: "Completed",
      jobs: sortedJobs.filter((job) => getJobSection(job.status) === "completed"),
    },
  ];
  const visibleSections = sections.filter((section) => section.jobs.length > 0);

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="gap-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <CardTitle>Jobs</CardTitle>
              {isLoading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Sync Jobs
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {!isLoading && sortedJobs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No jobs yet.
          </div>
        )}

        {visibleSections.length > 0 && (
          <div>
            {visibleSections.map((section) => (
              <JobSection key={section.key} title={section.title} count={section.jobs.length}>
                {section.jobs.map((job) => (
                  <JobItem
                    key={job.id}
                    job={job}
                    runId={runId}
                    runStatus={effectiveRunStatus}
                  />
                ))}
              </JobSection>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
