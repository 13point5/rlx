import { NewRunLayout } from "./new-run-layout";
import { getNewRunData } from "./new-run-data";

interface NewRunPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gpu?: string; count?: string }>;
}

export default async function NewRunPage({ params, searchParams }: NewRunPageProps) {
  const search = await searchParams;
  const { id } = await params;
  const { gpuDataResult, selectedGpu, selectedCount } = await getNewRunData(search);

  return (
    <NewRunLayout
      projectId={Number(id)}
      gpuDataResult={gpuDataResult}
      selectedGpu={selectedGpu}
      selectedCount={selectedCount}
    />
  );
}
