import { getProjects, getProject } from "@/app/actions/api";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: {
    src: string;
    alt: string;
    rounded?: "full" | "sm";
  };
  items?: {
    label: string;
    href: string;
    active?: boolean;
    icon?: { src: string; alt: string; rounded?: "full" | "sm" };
  }[];
}

export async function getProjectsDropdown(currentProjectId?: number) {
  const result = await getProjects();
  if (!result.success || !result.projects) {
    return [];
  }

  return result.projects.map((project) => ({
    label: project.repo_name,
    href: `/projects/${project.id}`,
    active: project.id === currentProjectId,
    icon: {
      src: `https://github.com/${project.repo_owner}.png`,
      alt: project.repo_owner,
      rounded: (project.repo_owner_type === "user" ? "full" : "sm") as
        | "full"
        | "sm",
    },
  }));
}

export async function generateBreadcrumbs(pathSegments: string[]): Promise<{
  breadcrumbs: BreadcrumbItem[];
  error?: string;
}> {
  try {
    const breadcrumbs: BreadcrumbItem[] = [];

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];

      switch (segment) {
        case "home":
          // Skip home in breadcrumbs
          break;

        case "projects":
          // Skip "Projects" prefix, just handle project IDs directly
          break;

        case "settings":
          breadcrumbs.push({
            label: "Settings",
            href: "/settings",
          });
          break;

        default:
          // Handle dynamic segments (project IDs)
          if (i === 1 && pathSegments[0] === "projects") {
            // This could be a project ID or "new"
            if (segment === "new") {
              breadcrumbs.push({
                label: "New Project",
                href: "/projects/new",
              });
              break;
            }

            const projectId = Number(segment);
            if (isNaN(projectId)) {
              throw new Error(`Invalid project ID: ${segment}`);
            }

            const projectResult = await getProject(projectId);
            if (!projectResult.success) {
              throw new Error(projectResult.error || "Failed to load project");
            }

            const project = projectResult.project!;
            const projectsDropdown = await getProjectsDropdown(projectId);

            breadcrumbs.push({
              label: project.repo_name,
              href: `/projects/${projectId}`,
              icon: {
                src: `https://github.com/${project.repo_owner}.png`,
                alt: project.repo_owner,
                rounded: (project.repo_owner_type === "user"
                  ? "full"
                  : "sm") as "full" | "sm",
              },
              items: projectsDropdown,
            });
          } else if (i === 0) {
            // Handle root segments other than home and projects
            if (segment !== "home" && segment !== "projects") {
              breadcrumbs.push({
                label: segment.charAt(0).toUpperCase() + segment.slice(1),
                href: `/${segment}`,
              });
            }
          } else {
            // For any other nested segments, use the segment as label
            let label = segment.charAt(0).toUpperCase() + segment.slice(1);

            // Handle special cases
            if (segment === "new") {
              // Determine if this is "new run" or other "new"
              const previousSegment = pathSegments[i - 1];
              if (previousSegment === "runs") {
                label = "New Run";
              }
            }

            breadcrumbs.push({
              label,
              href: "/" + pathSegments.slice(0, i + 1).join("/"),
            });
          }
          break;
      }
    }

    return { breadcrumbs };
  } catch (error) {
    console.error("Error generating breadcrumbs:", error);
    return {
      breadcrumbs: [],
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
