"use client";

import Link from "next/link";
import { GitHubAvatar } from "@/components/github-avatar";
import { GitHubIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  const repoFullName = `${project.repo_owner}/${project.repo_name}`;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-accent/50 hover:bg-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitHubAvatar
              username={project.repo_owner}
              avatarUrl={`https://github.com/${project.repo_owner}.png`}
              type={project.repo_owner_type}
              size={16}
            />
            <span>{project.repo_owner}</span>
          </div>
          <span
            onClick={(e) => {
              e.preventDefault();
              window.open(`https://github.com/${repoFullName}`, "_blank");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <GitHubIcon className="size-4" />
          </span>
        </div>

        <div className="truncate font-semibold text-foreground-bright">
          {project.repo_name}
        </div>

        <div>
          {project.active_runs > 0 ? (
            <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
              {project.active_runs} active run
              {project.active_runs > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              No active runs
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="size-4" />
      </div>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </Card>
  );
}
