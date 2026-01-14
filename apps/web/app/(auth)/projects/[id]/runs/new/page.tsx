import { notFound, redirect } from "next/navigation";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import {
  getGpuSummary,
  getProject,
} from "@/app/actions/api";
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
        redirect(`/projects/${id}/runs/new?gpu=${firstGpuType}&count=${firstCountKey}`);
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">New Run</h1>
          <p className="text-muted-foreground">
            Start a new training run for {project.repo_name}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row w-full">
          <div className="max-h-[70vh] overflow-y-auto">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Run Configuration
            </CardTitle>
            <CardDescription>
              Configure your training run settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-name">Run Name</Label>
              <Input id="run-name" placeholder="Training Run #1" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">main</SelectItem>
                  <SelectItem value="develop">develop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="config">Config File</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select config" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ppo.yaml">ppo.yaml</SelectItem>
                  <SelectItem value="dpo.yaml">dpo.yaml</SelectItem>
                  <SelectItem value="sft.yaml">sft.yaml</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gpu">GPU Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select GPU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="h100">H100</SelectItem>
                  <SelectItem value="a100">A100</SelectItem>
                  <SelectItem value="v100">V100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Advanced Settings
            </CardTitle>
            <CardDescription>Additional configuration options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description for this run..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-steps">Maximum Steps</Label>
              <Input id="max-steps" type="number" placeholder="10000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed">Random Seed</Label>
              <Input id="seed" type="number" placeholder="42" />
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1">
                <Zap className="w-4 h-4 mr-2" />
                Start Run
              </Button>
              <Button variant="outline">Save as Draft</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </HydrationBoundary>
  );
}
