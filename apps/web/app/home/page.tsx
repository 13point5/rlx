import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// TODO: Replace with actual API call
// A project = GitHub repo
const mockProjects = [
  {
    id: "1",
    name: "openrlhf-experiments",
    owner: "13point5",
    ownerType: "user" as const,
    activeRuns: 2,
  },
  {
    id: "2",
    name: "ppo-training",
    owner: "13point5",
    ownerType: "user" as const,
    activeRuns: 0,
  },
  {
    id: "3",
    name: "trl",
    owner: "huggingface",
    ownerType: "org" as const,
    activeRuns: 1,
  },
  {
    id: "4",
    name: "grpo-experiments",
    owner: "huggingface",
    ownerType: "org" as const,
    activeRuns: 0,
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
        {/* Search and New Project */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search Projects..." className="pl-9" />
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="size-4" />
              Add New
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
