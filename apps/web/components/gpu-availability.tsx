"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { getGpuAvailability } from "@/app/actions/api";
import { Badge } from "@/components/ui/badge";
import { ShieldCheckIcon, ServerIcon, HardDrive, Database, Clock, ZapIcon } from "lucide-react";

// Match the actual Prime Intellect API response format
interface GpuInstancePrices {
  currency: string;
  onDemand: number | null;
  communityPrice: number | null;
  isVariable: boolean;
}

interface GpuInstance {
  cloudId: string;
  gpuType: string;
  socket: string;
  provider: string;
  gpuCount: number;
  gpuMemory: number;
  security: string;
  prices: GpuInstancePrices;
  images: string[];
  region: string;
  dataCenter: string;
  country: string;
  stockStatus: string;
  provisioningTime?: number | null;
  vcpu?: { defaultCount: number };
  memory?: { defaultCount: number };
  disk?: {
    minCount: number;
    defaultCount: number;
    maxCount: number;
    pricePerUnit: number;
  };
  isSpot?: boolean;
}

interface AvailabilityResponse {
  items: GpuInstance[];
  totalCount: number;
}

function formatGpuName(gpuType: string): string {
  // Convert "H100_80GB" to "H100 80GB"
  return gpuType.replace(/_/g, " ");
}

function getProviderDisplayName(provider: string): string {
  const providerNames: Record<string, string> = {
    runpod: "RunPod",
    fluidstack: "FluidStack",
    hyperstack: "Hyperstack",
    datacrunch: "DataCrunch",
    lambdalabs: "Lambda Labs",
    tensordock: "TensorDock",
    primecompute: "Prime Compute",
    nebius: "Nebius",
    vultr: "Vultr",
  };
  return providerNames[provider.toLowerCase()] || provider;
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getSpinUpTimeColor(minutes: number): string {
  if (minutes < 5) return "text-green-500";
  if (minutes <= 10) return "text-yellow-500";
  return "text-red-500";
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

      const result = await getGpuAvailability({
        gpu_type: selectedGpu,
        gpu_count: parseInt(selectedCount, 10),
        page: 1,
        page_size: 20,
      });

      console.log("GPU Availability API response:", result);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch GPU availability");
      }

      return result.data as AvailabilityResponse;
    },
    enabled: !!selectedGpu && !!selectedCount,
    staleTime: 30 * 1000,
  });

  if (!selectedGpu || !selectedCount) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available Instances</h2>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available Instances</h2>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-md border border-border animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Available Instances</h2>
        </div>
        <p className="text-sm text-destructive">
          Error loading instances: {(error as Error).message}
        </p>
      </div>
    );
  }

  const instances = [...(data?.items || [])].sort((a, b) => {
    const priceA = a.prices.onDemand ?? a.prices.communityPrice ?? Infinity;
    const priceB = b.prices.onDemand ?? b.prices.communityPrice ?? Infinity;
    return priceA - priceB;
  });
  const displayName = selectedGpu.replace(/_/g, " ");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Available Instances</h2>
        <span className="text-sm text-muted-foreground">
          {data?.totalCount || instances.length} available
        </span>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No instances available for {displayName} x {selectedCount}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-h-[calc(70vh-100px)] overflow-y-auto pr-1">
          {instances.map((instance, idx) => {
            const price = instance.prices.onDemand ?? instance.prices.communityPrice;

            return (
              <div key={idx} className="p-4 border border-border rounded-md bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="space-y-4">
                  {/* Header with GPU name and price */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">
                        {formatGpuName(instance.gpuType)} x {instance.gpuCount}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {instance.isSpot && (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/50">
                            <ZapIcon className="size-3 mr-1" />
                            SPOT
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-muted/50 border-muted-foreground/30">
                          {instance.socket}
                        </Badge>
                        <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/30">
                          <ShieldCheckIcon className="size-3 mr-1" />
                          {instance.security.toUpperCase().replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {getProviderDisplayName(instance.provider)}
                      </p>
                      <p className="text-2xl font-bold mt-1">
                        ${price?.toFixed(2) || "N/A"}
                        <span className="text-sm font-normal text-muted-foreground ml-1">usd/hr</span>
                      </p>
                    </div>
                  </div>

                  {/* Specs Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <ServerIcon className="size-4" />
                        <span className="text-sm">CPU</span>
                      </div>
                      <p className="font-medium">{instance.vcpu?.defaultCount || 'N/A'} <span className="text-muted-foreground text-sm">CPU</span></p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Database className="size-4" />
                        <span className="text-sm">Memory</span>
                      </div>
                      <p className="font-medium">{instance.memory?.defaultCount || 'N/A'} <span className="text-muted-foreground text-sm">GB</span></p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="size-4" />
                        <span className="text-sm">Disk size</span>
                      </div>
                      <p className="font-medium">{instance.disk?.defaultCount || 'N/A'} <span className="text-muted-foreground text-sm">GB</span></p>
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {instance.provisioningTime != null && (
                      <div className={`flex items-center gap-1.5 ${getSpinUpTimeColor(instance.provisioningTime)}`}>
                        <Clock className="size-3.5" />
                        <span>~{instance.provisioningTime} min spin up</span>
                      </div>
                    )}
                    <span>{getCountryFlag(instance.country)} {instance.dataCenter || instance.country}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
