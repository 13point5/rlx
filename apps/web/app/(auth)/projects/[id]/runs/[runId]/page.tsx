import { getRun } from "@/app/actions/api";
import { ErrorState } from "@/components/error-state";
import { MetricsChart, RolloutsPanel } from "@/components/metrics";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobsPanel } from "./jobs-panel";
import { RunStatusPanel } from "./run-status-panel";

interface RunPageProps {
  params: Promise<{ id: string; runId: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { id, runId } = await params;
  const runIdNumber = Number(runId);

  const runResult = await getRun(runIdNumber);

  if (!runResult.success || !runResult.run) {
    return (
      <ErrorState
        title="Failed to load run"
        message={runResult.error || "Unable to load run details"}
      />
    );
  }

  const run = runResult.run;

  return (
    <div className="space-y-6">
      <PageHeading>{run.name}</PageHeading>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Run Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Branch: {run.branch}</div>
            <div>Config: {run.config_name}</div>
            <div>
              GPU: {run.gpu_type} x{run.gpu_count}
            </div>
            <div>Provider: {run.provider}</div>
            <div>Region: {run.region}</div>
          </CardContent>
        </Card>
        <RunStatusPanel runId={runIdNumber} initialStatus={run.status} />
      </div>

      {/* Training Metrics Chart */}
      <MetricsChart runId={runIdNumber} />

      {/* Rollouts / Samples */}
      <RolloutsPanel runId={runIdNumber} />

      <JobsPanel runId={runIdNumber} runStatus={run.status} />
    </div>
  );
}
