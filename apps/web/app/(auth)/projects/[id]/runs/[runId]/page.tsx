import { getRun } from "@/app/actions/api";
import { ExternalLink } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobsPanel } from "./jobs-panel";
import { RunObservabilityPanel } from "./run-observability-panel";
import { RunStatusPanel } from "./run-status-panel";

interface RunPageProps {
  params: Promise<{ id: string; runId: string }>;
}

export default async function RunPage({ params }: RunPageProps) {
  const { runId } = await params;
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
  const orchestratorWandbUrl = run.monitoring?.wandb?.orchestrator?.url;
  const trainerWandbUrl = run.monitoring?.wandb?.trainer?.url;

  return (
    <div className="relative left-1/2 flex w-[min(1800px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-4">
      <Tabs defaultValue="logs" className="gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
            <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">
              {run.name}
            </h1>

            <TabsList className="h-10 w-full justify-start overflow-x-auto xl:w-auto xl:flex-none">
              <TabsTrigger value="logs" className="px-5 text-sm">
                Logs
              </TabsTrigger>
              <TabsTrigger value="jobs" className="px-5 text-sm">
                Jobs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {orchestratorWandbUrl && (
              <Button asChild size="lg" variant="outline" className="h-10 px-4">
                <a href={orchestratorWandbUrl} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Orchestrator W&B
                </a>
              </Button>
            )}
            {trainerWandbUrl && (
              <Button asChild size="lg" variant="outline" className="h-10 px-4">
                <a href={trainerWandbUrl} target="_blank" rel="noreferrer">
                  <ExternalLink data-icon="inline-start" />
                  Trainer W&B
                </a>
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="logs">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
            <RunObservabilityPanel
              runId={runIdNumber}
              initialRunStatus={run.status}
            />
            <RunStatusPanel
              runId={runIdNumber}
              initialStatus={run.status}
              run={run}
              className="self-start"
            />
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <JobsPanel runId={runIdNumber} runStatus={run.status} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
