import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

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

        {/* Projects Grid */}
        {hasProjects ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
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
