import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjectRuns, getRunStatuses } from "@/app/actions/api";
import { getProject } from "@/lib/data";
import { SettingsTab } from "./tabs/settings";
import type { RunRecord } from "@/lib/types";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const projectId = Number(id);

  const projectResult = await getProject(projectId);

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
  const runsResult = await getProjectRuns(projectId);

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
  const statusesResult = runIds.length
    ? await getRunStatuses(runIds)
    : { success: true, statuses: {} };
  const statusMap = statusesResult.success ? statusesResult.statuses ?? {} : {};
  const statusError = statusesResult.success ? null : statusesResult.error;

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
        {statusError && (
          <p className="text-sm text-destructive">
            {typeof statusError === "string"
              ? statusError
              : "Unable to load live statuses"}
          </p>
        )}
        <div className="border border-border overflow-hidden rounded-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>GPU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    No runs yet.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => {
                  const liveStatus = statusMap[run.id]?.status;
                  const status = liveStatus ?? run.status;

                  return (
                    <TableRow key={run.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/projects/${id}/runs/${run.id}`}>
                          <div className="font-medium hover:underline">
                            {run.name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {run.config_path}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
                          <GitBranch className="size-3" />
                          <span className="max-w-[120px] truncate">
                            {run.branch}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {run.gpu_type} x{run.gpu_count}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(run.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colors = {
    active: "bg-green-500/10 text-green-500 border-green-500/30",
    provisioning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    error: "bg-red-500/10 text-red-500 border-red-500/30",
    stopped: "bg-gray-500/10 text-gray-500 border-gray-500/30",
    terminated: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-none border px-2 py-0.5 text-xs capitalize ${
        colors[normalized as keyof typeof colors] ?? colors.pending
      }`}
    >
      {normalized}
    </span>
  );
}
