import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectRuns, getRunStatuses } from "@/app/actions/api";
import { getProject } from "@/lib/data";
import { SettingsTab } from "./tabs/settings";
import { RunsTable } from "./runs-table";
import type { RunRecord } from "@/lib/types";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const projectId = Number(id);

  // Fetch project and runs in parallel - they're independent
  const [projectResult, runsResult] = await Promise.all([
    getProject(projectId),
    getProjectRuns(projectId),
  ]);

  if (!projectResult.success) {
    if (projectResult.error?.toLowerCase().includes("not found")) {
      notFound();
    }
    return (
      <ErrorState
        title="Failed to load project"
        message={projectResult.error}
      />
    );
  }

  const project = projectResult.project!;

  if (!runsResult.success) {
    return (
      <ErrorState
        title="Failed to load runs"
        message={runsResult.error || "Unable to load runs"}
      />
    );
  }

  const runs = (runsResult.runs ?? []) as RunRecord[];
  const runIds = runs.map((run) => run.id);
  // Statuses depend on run IDs, so this stays sequential
  const statusesResult = runIds.length
    ? await getRunStatuses(runIds)
    : { success: true, statuses: {} };
  const statusMap = statusesResult.success
    ? (statusesResult.statuses ?? {})
    : {};
  const statusMessage = statusesResult.success
    ? null
    : typeof statusesResult.error === "string"
      ? statusesResult.error
      : "Unable to load live statuses";

  return (
    <Tabs defaultValue="runs" className="space-y-4">
      <div className="space-y-4">
        <PageHeading>Runs</PageHeading>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="configs">Configs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <Button asChild>
            <Link href={`/projects/${id}/runs/new`}>
              <Plus className="size-4" />
              New Run
            </Link>
          </Button>
        </div>
      </div>

      <TabsContent value="runs" className="space-y-4">
        <RunsTable
          projectId={id}
          runs={runs}
          statusMap={statusMap}
          statusMessage={statusMessage}
        />
      </TabsContent>

      <TabsContent value="configs">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Config Files</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Config files from your repository will appear here.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <SettingsTab projectId={project.id} projectName={project.repo_name} />
      </TabsContent>
    </Tabs>
  );
}
