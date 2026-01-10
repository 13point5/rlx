"use client";

import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";

interface Project {
  id: string;
  name: string;
  repoFullName: string;
  activeRuns: number;
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-foreground/20 hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <span className="flex-1 font-semibold">{project.name}</span>
          <span
            onClick={(e) => {
              e.preventDefault();
              window.open(
                `https://github.com/${project.repoFullName}`,
                "_blank"
              );
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <GitHubIcon className="size-4" />
          </span>
        </div>

        <div>
          {project.activeRuns > 0 ? (
            <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-500">
              {project.activeRuns} active run{project.activeRuns > 1 ? "s" : ""}
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
