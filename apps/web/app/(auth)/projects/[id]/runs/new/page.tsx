import { notFound, redirect } from "next/navigation";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { getGpuSummary, getProject } from "@/app/actions/api";
import { ErrorState } from "@/components/error-state";
import { GpuSelection } from "@/components/gpu-selection";
import { GpuAvailability } from "@/components/gpu-availability";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Zap } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NewRunPage({ params, searchParams }: Props) {
  const { id } = await params;
  const search = await searchParams;

  const projectResult = await getProject(Number(id));
  const summaryResult = await getGpuSummary();

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

  // If GPU summary is available and no GPU is selected, redirect to first GPU
  if (summaryResult.success && summaryResult.data && !search.gpu) {
    const entries = Object.entries(summaryResult.data);
    if (entries.length > 0) {
      const firstGpuType = entries[0][0];
      const firstGpuCounts = entries[0][1] as Record<string, unknown>;
      const firstCountKey = Object.entries(firstGpuCounts).filter(
        ([, v]) => typeof v === "object"
      )[0]?.[0];

      if (firstGpuType && firstCountKey) {
        redirect(
          `/projects/${id}/runs/new?gpu=${firstGpuType}&count=${firstCountKey}`
        );
      }
    }
  }

  const queryClient = new QueryClient();

  // Prefetch GPU summary for client-side rendering
  await queryClient.prefetchQuery({
    queryKey: ["gpu-summary"],
    queryFn: async () => {
      const result = await getGpuSummary();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch GPU summary");
      }
      return result.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">New Run</h1>

        <div className="flex flex-col gap-4 lg:flex-row w-full">
          <div className="overflow-y-auto">
            {summaryResult.success && summaryResult.data ? (
              <GpuSelection summary={summaryResult.data} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load GPU summary:{" "}
                {summaryResult.error || "unknown error"}
              </p>
            )}
          </div>

          <div className="flex-1">
            <GpuAvailability />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
