import { NewRunLayout } from "./new-run-layout";
import { getNewRunData } from "./new-run-data";

interface NewRunPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gpu?: string; count?: string }>;
}

export default async function NewRunPage({ params, searchParams }: NewRunPageProps) {
  const search = await searchParams;
  const { id } = await params;
  const projectId = Number(id);
  const { gpuDataResult, branchesDataResult, selectedGpu, selectedCount } = await getNewRunData(search, projectId);

  return (
    <NewRunLayout
      projectId={projectId}
      gpuDataResult={gpuDataResult}
      branchesDataResult={branchesDataResult}
      selectedGpu={selectedGpu}
      selectedCount={selectedCount}
    />
  );
}
