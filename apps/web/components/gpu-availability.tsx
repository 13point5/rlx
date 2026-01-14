"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { getGpuAvailability } from "@/app/actions/api";
import { Card } from "@/components/ui/card";
import { ShieldCheckIcon, ZapIcon, ServerIcon } from "lucide-react";

interface GpuInstance {
  gpu_name: string;
  num_gpus: number;
  total_gpus: number;
  gpu_memory_gb: number;
  cpu_cores_effective: number;
  memory_gb: number;
  storage_gb: number;
  spot_price: number | null;
  on_demand_price: number | null;
  datacenter: {
    name: string;
    location: string;
  };
  security_level: string;
  availability: string;
}

interface AvailabilityResponse {
  instances: GpuInstance[];
  total: number;
  page: number;
  page_size: number;
}

export function GpuAvailability() {
  const searchParams = useSearchParams();
  const selectedGpu = searchParams.get("gpu");
  const selectedCount = searchParams.get("count");

  const { data, isLoading, error } = useQuery({
    queryKey: ["gpu-availability", selectedGpu, selectedCount],
    queryFn: async () => {
      if (!selectedGpu || !selectedCount) {
        return null;
      }

      // Parse GPU type and count for API
      const result = await getGpuAvailability({
        gpu_type: selectedGpu,
        page: 1,
        page_size: 10,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch GPU availability");
      }

      return result.data as AvailabilityResponse;
    },
    enabled: !!selectedGpu && !!selectedCount,
    staleTime: 30 * 1000, // 30 seconds
  });

  if (!selectedGpu || !selectedCount) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">GPU Instances</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a GPU configuration on the left to view available instances and
          pricing details.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">GPU Instances</h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-md bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">GPU Instances</h2>
        </div>
        <p className="text-sm text-destructive">
          Error loading instances: {(error as Error).message}
        </p>
      </div>
    );
  }

  const instances = data?.instances || [];
  const displayName = selectedGpu.replace(/_/g, " ");

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">GPU Instances</h2>
        <span className="text-sm text-muted-foreground">
          {instances.length} available
        </span>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No instances available for {displayName} x {selectedCount}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(60vh-80px)] overflow-y-auto pr-1">
          {instances.map((instance, idx) => (
            <Card key={idx} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">
                      {instance.gpu_name} x {instance.num_gpus}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {instance.datacenter.name} • {instance.datacenter.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <ZapIcon className="size-3.5 text-amber-400" />
                      <span className="text-sm font-mono">
                        {instance.spot_price !== null
                          ? `$${instance.spot_price.toFixed(2)}`
                          : "N/A"}
                      </span>
                      <span className="text-xs text-muted-foreground">usd/hr</span>
                    </div>
                  </div>
                </div>

                {/* Specs */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <ServerIcon className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">CPU</span>
                    <span className="font-medium">{instance.cpu_cores_effective}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Memory</span>
                    <span className="font-medium">{instance.memory_gb} GB</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Disk</span>
                    <span className="font-medium">{instance.storage_gb} GB</span>
                  </div>
                </div>

                {/* Pricing and Security */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {instance.security_level.toLowerCase().includes("secure") ? (
                        <>
                          <ShieldCheckIcon className="size-3.5 text-sky-400" />
                          <span className="text-xs text-sky-400 uppercase font-medium">
                            Secure Cloud
                          </span>
                        </>
                      ) : (
                        <>
                          <ZapIcon className="size-3.5 text-amber-400" />
                          <span className="text-xs text-amber-400 uppercase font-medium">
                            Spot
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {instance.on_demand_price !== null && (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheckIcon className="size-3.5 text-sky-400" />
                        <span className="text-xs font-mono">
                          ${instance.on_demand_price.toFixed(2)}/hr
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
