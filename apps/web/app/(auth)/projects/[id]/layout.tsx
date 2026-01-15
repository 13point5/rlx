import { getProject } from "@/lib/data";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/error-state";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
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

  return <div className="space-y-6">{children}</div>;
}
