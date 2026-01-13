import Image from "next/image";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
}

export const ProjectHeading = ({ project }: Props) => {
  const repoFullName = `${project.repo_owner}/${project.repo_name}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <a
        href={`https://github.com/${repoFullName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 hover:opacity-80"
      >
        <Image
          src={`https://github.com/${project.repo_owner}.png`}
          alt={project.repo_owner}
          width={24}
          height={24}
          className={
            project.repo_owner_type === "User" ? "rounded-full" : "rounded-sm"
          }
        />
        <h1 className="text-xl tracking-tight">
          <span className="text-muted-foreground">{project.repo_owner}</span>
          <span className="text-muted-foreground/50 mx-1">/</span>
          <span className="font-bold">{project.repo_name}</span>
        </h1>
      </a>
    </div>
  );
};
