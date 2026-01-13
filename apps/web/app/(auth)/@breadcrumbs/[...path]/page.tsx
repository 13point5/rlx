import { generateBreadcrumbs } from "@/lib/breadcrumb-utils";
import { BreadcrumbErrorDialog } from "@/components/breadcrumb-error-dialog";
import { AppHeader } from "@/components/app-header";

interface Props {
  params: Promise<{ path: string[] }>;
}

export default async function BreadcrumbPage({ params }: Props) {
  const { path } = await params;

  const { breadcrumbs, error } = await generateBreadcrumbs(path);

  if (error) {
    return (
      <BreadcrumbErrorDialog
        error={error}
        onRefresh={() => window.location.reload()}
        onGoHome={() => (window.location.href = "/home")}
      />
    );
  }

  return <AppHeader breadcrumbs={breadcrumbs} isLoading={false} />;
}
