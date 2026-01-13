import { getProject } from "@/app/actions/api";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/error-state";
import { ProjectHeading } from "@/components/project-heading";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params;

  // Get project data for the heading
  const projectResult = await getProject(Number(id));

  if (!projectResult.success) {
    if (projectResult.error?.toLowerCase().includes("not found")) {
      notFound();
    }
    return (
      <ErrorState
        title="Failed to load project"
        message={projectResult.error}
      />
    );
  }

  const project = projectResult.project!;

  return (
    <div className="space-y-6">
      <ProjectHeading project={project} />
      {children}
    </div>
  );
}
