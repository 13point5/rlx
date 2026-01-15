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
import { getProject } from "@/lib/data";
import { SettingsTab } from "./tabs/settings";

// TODO: Replace with actual API call when runs API is implemented
const mockRuns = [
  {
    id: "run-1",
    name: "Training Run #1",
    branch: "main",
    config: "configs/ppo.yaml",
    status: "completed",
    createdAt: "2 hours ago",
    gpu: "H100",
  },
  {
    id: "run-2",
    name: "Training Run #2",
    branch: "feature/dpo",
    config: "configs/dpo.yaml",
    status: "running",
    createdAt: "30 min ago",
    gpu: "A100",
  },
  {
    id: "run-3",
    name: "Training Run #3",
    branch: "main",
    config: "configs/ppo.yaml",
    status: "failed",
    createdAt: "1 day ago",
    gpu: "H100",
  },
];

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  const projectResult = await getProject(Number(id));

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
        <div className="rounded-lg border overflow-x-auto">
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
              {mockRuns.map((run) => (
                <TableRow key={run.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/projects/${id}/runs/${run.id}`}>
                      <div className="font-medium hover:underline">
                        {run.name}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {run.config}
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
                    {run.gpu}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {run.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="configs">
        <Card>
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
  const colors = {
    running: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    pending: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        colors[status as keyof typeof colors] ?? colors.pending
      }`}
    >
      {status}
    </span>
  );
}
