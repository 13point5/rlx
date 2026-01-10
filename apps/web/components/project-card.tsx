"use client";

import Image from "next/image";
import Link from "next/link";
import { GitHubIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";

interface Project {
  id: string;
  name: string;
  owner: string;
  ownerType: "user" | "org";
  activeRuns: number;
}

export function ProjectCard({ project }: { project: Project }) {
  const repoFullName = `${project.owner}/${project.name}`;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex flex-col gap-2 p-4 transition-colors hover:border-foreground/20 hover:bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Image
              src={`https://github.com/${project.owner}.png`}
              alt={project.owner}
              width={16}
              height={16}
              className={project.ownerType === "user" ? "rounded-full" : "rounded-sm"}
            />
            <span>{project.owner}</span>
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

        <div className="truncate font-semibold">{project.name}</div>

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
