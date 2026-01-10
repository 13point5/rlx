import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TODO: Replace with actual API call
const mockProjects = [
  {
    id: "1",
    name: "openrlhf-experiments",
    emoji: "🧪",
    repoFullName: "user/openrlhf-experiments",
    defaultBranch: "main",
    lastRunAt: "2 hours ago",
    lastRunStatus: "completed" as const,
  },
  {
    id: "2",
    name: "ppo-training",
    emoji: "🚀",
    repoFullName: "user/ppo-training",
    defaultBranch: "develop",
    lastRunAt: "1 day ago",
    lastRunStatus: "running" as const,
  },
  {
    id: "3",
    name: "reward-model-finetune",
    emoji: "🎯",
    repoFullName: "user/reward-model-finetune",
    defaultBranch: "main",
    lastRunAt: "3 days ago",
    lastRunStatus: "failed" as const,
  },
];

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: Fetch actual projects from API
  const projects = mockProjects;
  const hasProjects = projects.length > 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">
              Manage your RL training projects and runs.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              New Project
            </Link>
          </Button>
        </div>

        {/* Projects Table */}
        {hasProjects ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center gap-3"
                      >
                        <span className="text-xl">{project.emoji}</span>
                        <div>
                          <div className="font-medium hover:underline">
                            {project.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.repoFullName}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <GitBranch className="size-4" />
                        {project.defaultBranch}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project.lastRunAt ?? "—"}
                    </TableCell>
                    <TableCell>
                      {project.lastRunStatus && (
                        <StatusBadge status={project.lastRunStatus} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project by connecting a GitHub repository with your RL training configs."
            actionLabel="Create Project"
            actionHref="/projects/new"
          />
        )}
      </div>
    </AppShell>
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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status as keyof typeof colors] ?? colors.pending}`}
    >
      {status}
    </span>
  );
}
