import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ProjectCard } from "@/components/project-card";
import { OnboardingWrapper } from "@/components/onboarding-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProjects } from "@/app/actions/api";
import { PageHeading } from "@/components/page-heading";

export default async function HomePage() {
  const result = await getProjects();

  if (!result.success) {
    return (
      <ErrorState title="Failed to load projects" message={result.error} />
    );
  }

  const projects = result.projects ?? [];
  const hasProjects = projects.length > 0;

  return (
    <OnboardingWrapper hasProjects={hasProjects}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeading>Projects</PageHeading>

        {/* Search and New Project */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search Projects..." className="pl-9" />
          </div>
          <Button asChild className="sm:w-auto">
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
    </OnboardingWrapper>
  );
}
