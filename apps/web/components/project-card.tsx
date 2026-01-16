"use client";

import Link from "next/link";
import { GitHubAvatar } from "@/components/github-avatar";
import { GitHubIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/lib/types";

interface ProjectCardProps {
  project: Project;
  isLast?: boolean;
}

export function ProjectCard({ project, isLast = false }: ProjectCardProps) {
  const repoFullName = `${project.repo_owner}/${project.repo_name}`;

  return (
    <Link href={`/projects/${project.id}`}>
      <div
        className={`flex items-center gap-4 bg-card px-4 py-3 transition-colors hover:bg-muted/30 ${
          !isLast ? "border-b border-border" : ""
        }`}
      >
        {/* Left: Owner info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[140px]">
          <GitHubAvatar
            username={project.repo_owner}
            avatarUrl={`https://github.com/${project.repo_owner}.png`}
            type={project.repo_owner_type}
            size={16}
          />
          <span className="truncate">{project.repo_owner}</span>
        </div>

        {/* Middle: Repo name */}
        <div className="flex-1 truncate text-foreground-bright">
          {project.repo_name}
        </div>

        {/* Right: Status and GitHub link */}
        <div className="flex items-center gap-3">
          {project.active_runs > 0 ? (
            <span className="inline-flex items-center border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
              {project.active_runs} active run
              {project.active_runs > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              No active runs
            </span>
          )}
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
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 bg-card px-4 py-3 ${
        !isLast ? "border-b border-border" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-[140px]">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-5 w-48 flex-1" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="size-4" />
      </div>
    </div>
  );
}
