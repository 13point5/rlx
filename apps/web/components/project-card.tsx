import Link from "next/link";
import { GitBranch, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Project {
  id: string;
  name: string;
  emoji?: string;
  repoFullName: string;
  defaultBranch: string;
  lastRunAt?: string;
  lastRunStatus?: "running" | "completed" | "failed";
}

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusColors = {
    running: "text-yellow-500",
    completed: "text-green-500",
    failed: "text-red-500",
  };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center text-2xl">
              {project.emoji ?? "📁"}
            </div>
            <div>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{project.repoFullName}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GitBranch className="size-4" />
            <span>{project.defaultBranch}</span>
          </div>
          {project.lastRunAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="size-4" />
              <span>{project.lastRunAt}</span>
            </div>
          )}
          {project.lastRunStatus && (
            <div className={`flex items-center gap-1.5 ${statusColors[project.lastRunStatus]}`}>
              <PlayCircle className="size-4" />
              <span className="capitalize">{project.lastRunStatus}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={`/projects/${project.id}`}>View Runs</Link>
          </Button>
          <Button size="sm" className="flex-1" asChild>
            <Link href={`/projects/${project.id}/new-run`}>New Run</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
