import { NewRunLayout } from "./new-run-layout";
import { getNewRunData } from "./new-run-data";

interface NewRunPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gpu?: string; count?: string }>;
}

export default async function NewRunPage({ searchParams }: NewRunPageProps) {
  const search = await searchParams;
  const { summaryResult, selectedGpu, selectedCount, state } = await getNewRunData(search);

  return (
    <NewRunLayout
      summaryResult={summaryResult}
      selectedGpu={selectedGpu}
      selectedCount={selectedCount}
      state={state}
    />
  );
}
