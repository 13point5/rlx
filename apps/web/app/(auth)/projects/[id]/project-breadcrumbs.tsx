"use client";

import { useEffect } from "react";
import { useBreadcrumbs } from "@/components/breadcrumb-context";

interface Project {
  id: number;
  repo_name: string;
  repo_owner: string;
  repo_owner_type: string;
}

interface ProjectBreadcrumbsProps {
  currentProject: Project;
  allProjects: Project[];
}

export function ProjectBreadcrumbs({
  currentProject,
  allProjects,
}: ProjectBreadcrumbsProps) {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      {
        label: currentProject.repo_name,
        icon: {
          src: `https://github.com/${currentProject.repo_owner}.png`,
          alt: currentProject.repo_owner,
          rounded: currentProject.repo_owner_type === "user" ? "full" : "sm",
        },
        items: allProjects.map((p) => ({
          label: p.repo_name,
          href: `/projects/${p.id}`,
          active: p.id === currentProject.id,
          icon: {
            src: `https://github.com/${p.repo_owner}.png`,
            alt: p.repo_owner,
            rounded: p.repo_owner_type === "user" ? "full" : "sm",
          },
        })),
      },
    ]);
  }, [currentProject, allProjects, setBreadcrumbs]);

  return null;
}
