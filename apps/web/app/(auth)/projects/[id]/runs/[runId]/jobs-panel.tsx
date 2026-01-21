"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  FolderOpen,
  Terminal,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import {
  getRunJobs,
  getJobDetails,
  retryJob,
  syncRunJobs,
} from "@/app/actions/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  JobResponse,
  JobDetailResponse,
  JobStatus,
  JobType,
} from "@/lib/types";

interface JobsPanelProps {
  runId: number;
  runStatus: string;
}

function getJobTitle(job: JobResponse): string {
  const config = job.config;

  switch (job.job_type) {
    case "CLONE_REPO": {
      const repoUrl = config?.repo_url as string | undefined;
      if (repoUrl) {
        // Extract repo name from URL (e.g., "https://github.com/owner/repo.git" -> "repo")
        const match = repoUrl.match(/\/([^/]+?)(\.git)?$/);
        const repoName = match?.[1] || repoUrl;
        const targetDir = config?.target_dir as string | undefined;
        return `Clone ${repoName}${targetDir ? ` → ${targetDir}` : ""}`;
      }
      return "Clone Repository";
    }
    case "LIST_FILES": {
      const targetDir = config?.target_dir as string | undefined;
      return targetDir ? `List files in ${targetDir}` : "List Files";
    }
    case "CUSTOM_COMMAND": {
      const command = config?.command as string | undefined;
      if (command) {
        // Truncate long commands
        const truncated =
          command.length > 60 ? command.slice(0, 60) + "..." : command;
        return truncated;
      }
      return "Run Command";
    }
    default:
      return job.job_type;
  }
}

const jobTypeIcons: Record<JobType, React.ReactNode> = {
  CLONE_REPO: <FolderGit2 className="h-4 w-4" />,
  LIST_FILES: <FolderOpen className="h-4 w-4" />,
  CUSTOM_COMMAND: <Terminal className="h-4 w-4" />,
};

const statusConfig: Record<
  JobStatus,
  { icon: React.ReactNode; className: string; label: string }
> = {
  PENDING: {
    icon: <Circle className="h-4 w-4" />,
    className: "text-muted-foreground",
    label: "Pending",
  },
  QUEUED: {
    icon: <Clock className="h-4 w-4" />,
    className: "text-yellow-500",
    label: "Queued",
  },
  RUNNING: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    className: "text-blue-500",
    label: "Running",
  },
  SUCCESS: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-green-500",
    label: "Success",
  },
  FAILED: {
    icon: <XCircle className="h-4 w-4" />,
    className: "text-red-500",
    label: "Failed",
  },
  TIMEOUT: {
    icon: <XCircle className="h-4 w-4" />,
    className: "text-orange-500",
    label: "Timeout",
  },
  CANCELLED: {
    icon: <XCircle className="h-4 w-4" />,
    className: "text-gray-500",
    label: "Cancelled",
  },
};

function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status] ?? statusConfig.PENDING;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-normal", config.className)}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

function JobItem({ job, runId }: { job: JobResponse; runId: number }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Fetch job details (including commands with stdout/stderr) when expanded
  const { data: jobDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["job-details", job.id],
    queryFn: async () => {
      const response = await getJobDetails(job.id);
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch job details");
      }
      return response.job as JobDetailResponse;
    },
    enabled: expanded,
    staleTime: 10000, // Cache for 10 seconds
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await retryJob(job.id);
      if (!response.success) {
        throw new Error(response.error || "Failed to retry job");
      }
      return response.job;
    },
    onSuccess: () => {
      // Invalidate jobs list to refetch
      queryClient.invalidateQueries({ queryKey: ["run-jobs", runId] });
      // Clear job details cache
      queryClient.invalidateQueries({ queryKey: ["job-details", job.id] });
    },
  });

  // Job can be retried if it's in a failed/cancelled/timeout state
  const canRetry =
    job.status === "FAILED" ||
    job.status === "CANCELLED" ||
    job.status === "TIMEOUT";

  return (
    <div className="border-b border-border last:border-0">
      <div
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span className="text-muted-foreground">
          {jobTypeIcons[job.job_type]}
        </span>
        <span
          className="font-medium text-sm truncate max-w-[400px]"
          title={getJobTitle(job)}
        >
          {getJobTitle(job)}
        </span>
        <JobStatusBadge status={job.status} />
        {job.completed_at && job.started_at && (
          <span className="text-xs text-muted-foreground">
            {(() => {
              const durationMs =
                new Date(job.completed_at).getTime() -
                new Date(job.started_at).getTime();
              return durationMs < 1000
                ? `${durationMs}ms`
                : `${(durationMs / 1000).toFixed(1)}s`;
            })()}
          </span>
        )}
        <div className="flex-1" />
        {canRetry && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              retryMutation.mutate();
            }}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            <span className="ml-1">Retry</span>
          </Button>
        )}
        <span className="text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </div>

      {expanded && (
        <div className="bg-muted/30 px-4 py-3 pl-12 space-y-3 text-sm">
          {isLoadingDetails && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Loading details...</span>
            </div>
          )}

          {/* Error message */}
          {job.error_message && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Error</p>
              <pre className="whitespace-pre-wrap text-xs text-destructive bg-destructive/10 rounded p-2 overflow-auto max-h-32">
                {job.error_message}
              </pre>
            </div>
          )}

          {/* Command output from job details */}
          {jobDetails?.commands && jobDetails.commands.length > 0 && (
            <div className="space-y-2">
              {jobDetails.commands.map((cmd, idx) => (
                <div key={cmd.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Command {jobDetails.commands.length > 1 ? idx + 1 : ""}
                    </p>
                    {cmd.exit_code !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          cmd.exit_code === 0
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        exit: {cmd.exit_code}
                      </Badge>
                    )}
                    {cmd.duration_ms !== null && (
                      <span className="text-xs text-muted-foreground">
                        {cmd.duration_ms < 1000
                          ? `${cmd.duration_ms}ms`
                          : `${(cmd.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </div>

                  {/* Command that was run */}
                  <pre className="whitespace-pre-wrap text-xs bg-muted rounded p-2 overflow-auto max-h-16 font-mono">
                    $ {cmd.command}
                  </pre>

                  {/* Stdout */}
                  {cmd.stdout && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Output</p>
                      <pre className="whitespace-pre-wrap text-xs bg-background border rounded p-2 overflow-auto max-h-48 font-mono">
                        {cmd.stdout}
                      </pre>
                    </div>
                  )}

                  {/* Stderr - show for all commands */}
                  {cmd.stderr && (
                    <div className="space-y-1">
                      <p className="text-xs text-orange-500">Stderr</p>
                      <pre className="whitespace-pre-wrap text-xs bg-orange-500/10 border border-orange-500/20 rounded p-2 overflow-auto max-h-48 font-mono text-orange-200">
                        {cmd.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Duration */}
          {job.completed_at && job.started_at && (
            <p className="text-xs text-muted-foreground">
              Total duration:{" "}
              {Math.round(
                (new Date(job.completed_at).getTime() -
                  new Date(job.started_at).getTime()) /
                  1000
              )}
              s
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function JobsPanel({ runId, runStatus }: JobsPanelProps) {
  const queryClient = useQueryClient();

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
    // Poll while run is active and jobs may still be processing
    refetchInterval: (query) => {
      const currentJobs = query.state.data;
      if (!currentJobs) return 5000;

      // Stop polling if run is terminated
      if (runStatus === "TERMINATED") return false;

      // Keep polling if any job is not in a terminal state
      const hasActiveJobs = currentJobs.some(
        (job) =>
          job.status === "PENDING" ||
          job.status === "QUEUED" ||
          job.status === "RUNNING"
      );

      return hasActiveJobs ? 3000 : false;
    },
  });

  // Sync jobs mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await syncRunJobs(runId);
      if (!response.success) {
        throw new Error(response.error || "Failed to sync jobs");
      }
      return response;
    },
    onSuccess: () => {
      // Refresh jobs list
      queryClient.invalidateQueries({ queryKey: ["run-jobs", runId] });
    },
  });

  const sortedJobs =
    jobs?.slice().sort((a, b) => a.sequence - b.sequence) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Jobs
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span className="ml-1">Sync Jobs</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="px-4 py-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {!isLoading && sortedJobs.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No jobs yet
          </div>
        )}

        {sortedJobs.length > 0 && (
          <div className="divide-y divide-border">
            {sortedJobs.map((job) => (
              <JobItem key={job.id} job={job} runId={runId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
