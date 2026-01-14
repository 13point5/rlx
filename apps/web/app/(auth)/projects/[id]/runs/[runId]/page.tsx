import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Pause,
  Square,
  Download,
  GitBranch,
  Calendar,
  Clock,
  Cpu,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { RunMetrics } from "@/components/run-metrics";
import { RunLogs } from "@/components/run-logs";
import { RunConfig } from "@/components/run-config";
import { RunSystemMetrics } from "@/components/run-system-metrics";

// TODO: Replace with actual API call when runs API is implemented
const mockRun = {
  id: "run-1",
  name: "Training Run #1",
  status: "running",
  branch: "main",
  commit: "a1b2c3d",
  config: "configs/ppo.yaml",
  gpu: "H100",
  createdAt: "2024-01-14T10:00:00Z",
  startedAt: "2024-01-14T10:01:30Z",
  updatedAt: "2024-01-14T12:30:00Z",
  duration: "2h 28m",
  progress: 65,
  currentStep: 6500,
  totalSteps: 10000,
};

interface Props {
  params: Promise<{ id: string; runId: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id, runId } = await params;

  // TODO: Fetch actual run data from API
  const run = mockRun;

  if (!run) {
    notFound();
  }

  const statusColors = {
    running: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    pending: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    stopped: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{run.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitBranch className="size-3" />
                {run.branch}
              </span>
              <span>•</span>
              <span>{run.commit}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(run.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium capitalize ${
                statusColors[run.status as keyof typeof statusColors] ??
                statusColors.pending
              }`}
            >
              <Activity className="mr-1.5 size-3" />
              {run.status}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Progress
                  </p>
                  <p className="text-2xl font-bold">
                    {run.currentStep.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of {run.totalSteps.toLocaleString()} steps
                  </p>
                </div>
                <div className="text-3xl font-bold text-muted-foreground">
                  {run.progress}%
                </div>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${run.progress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Clock className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Duration
                  </p>
                  <p className="text-2xl font-bold">{run.duration}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Cpu className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    GPU Type
                  </p>
                  <p className="text-2xl font-bold">{run.gpu}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Actions
                </p>
                <div className="flex gap-2">
                  {run.status === "running" ? (
                    <>
                      <Button size="sm" variant="outline">
                        <Pause className="size-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Square className="size-3" />
                      </Button>
                    </>
                  ) : run.status === "stopped" || run.status === "failed" ? (
                    <Button size="sm" variant="outline">
                      <Play className="size-3" />
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline">
                    <Download className="size-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <RunMetrics runId={runId} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <RunLogs runId={runId} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <RunConfig runId={runId} config={run.config} />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <RunSystemMetrics runId={runId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
