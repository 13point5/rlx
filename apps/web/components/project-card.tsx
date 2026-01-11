"use client";

import Image from "next/image";
import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: number;
  repo_name: string;
  repo_owner: string;
  repo_owner_type: "user" | "organization";
  active_runs: number;
}

export function ProjectCard({ project }: { project: Project }) {
  const repoFullName = `${project.repo_owner}/${project.repo_name}`;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-foreground/20 hover:bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Image
              src={`https://github.com/${project.repo_owner}.png`}
              alt={project.repo_owner}
              width={16}
              height={16}
              className={project.repo_owner_type === "user" ? "rounded-full" : "rounded-sm"}
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

        <div className="truncate font-semibold">{project.repo_name}</div>

        <div>
          {project.active_runs > 0 ? (
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
              {project.active_runs} active run{project.active_runs > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
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
