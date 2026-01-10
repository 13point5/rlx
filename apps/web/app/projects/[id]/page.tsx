import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, GitBranch, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// TODO: Replace with actual API call
const mockProjects = [
  { id: "1", name: "openrlhf-experiments", repoFullName: "user/openrlhf-experiments" },
  { id: "2", name: "ppo-training", repoFullName: "user/ppo-training" },
  { id: "3", name: "reward-model-finetune", repoFullName: "user/reward-model-finetune" },
];

const mockRuns = [
  { id: "run-1", name: "Training Run #1", branch: "main", config: "configs/ppo.yaml", status: "completed", createdAt: "2 hours ago", gpu: "H100" },
  { id: "run-2", name: "Training Run #2", branch: "feature/dpo", config: "configs/dpo.yaml", status: "running", createdAt: "30 min ago", gpu: "A100" },
  { id: "run-3", name: "Training Run #3", branch: "main", config: "configs/ppo.yaml", status: "failed", createdAt: "1 day ago", gpu: "H100" },
  { id: "run-4", name: "Training Run #4", branch: "experiment/grpo", config: "configs/grpo.yaml", status: "completed", createdAt: "3 days ago", gpu: "H100" },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const user = await currentUser();
  const { id } = await params;

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: Fetch actual project
  const project = mockProjects.find((p) => p.id === id) ?? mockProjects[0];

  const breadcrumbs = [
    {
      label: project.name,
      items: mockProjects.map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
        active: p.id === id,
      })),
    },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Project Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <a
              href={`https://github.com/${project.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight hover:underline"
            >
              {project.name}
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          </div>
          <Button asChild>
            <Link href={`/projects/${id}/new-run`}>
              <Plus className="size-4" />
              New Run
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="configs">Configs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="space-y-4">
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
                <div>Run</div>
                <div>Branch</div>
                <div>GPU</div>
                <div>Status</div>
                <div>Created</div>
              </div>
              {mockRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/projects/${id}/runs/${run.id}`}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b px-4 py-3 text-sm hover:bg-muted/50 last:border-0"
                >
                  <div>
                    <div className="font-medium">{run.name}</div>
                    <div className="text-muted-foreground text-xs">{run.config}</div>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GitBranch className="size-3" />
                    <span className="max-w-[120px] truncate">{run.branch}</span>
                  </div>
                  <div className="text-muted-foreground">{run.gpu}</div>
                  <div>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="text-muted-foreground">{run.createdAt}</div>
                </Link>
              ))}
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
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Project settings will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    running: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
    pending: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status as keyof typeof colors] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}
