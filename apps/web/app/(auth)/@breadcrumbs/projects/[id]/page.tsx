import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { getProject } from "@/lib/cached-api";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectBreadcrumbs({ params }: Props) {
  const { id } = await params;

  // Fetch project name for breadcrumb (uses cached version - no duplicate fetch)
  const projectResult = await getProject(Number(id));
  const projectName = projectResult.project?.repo_name || `Project ${id}`;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{projectName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
