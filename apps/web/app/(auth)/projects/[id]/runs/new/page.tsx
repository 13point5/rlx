import { getProject } from "@/lib/cached-api";
import { ErrorState } from "@/components/error-state";
import { ProjectHeading } from "@/components/project-heading";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewRunPage({ params }: Props) {
  const { id } = await params;

  // Fetch project
  const projectResult = await getProject(Number(id));

  // Handle project not found
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
      {/* Project Header */}
      <ProjectHeading project={project} />

      <h1 className="text-2xl font-bold tracking-tight">New Run</h1>
    </div>
  );
}
