"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GpuInstance } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ShieldCheckIcon,
  ServerIcon,
  HardDrive,
  Database,
  ZapIcon,
  Loader2,
  RefreshCwIcon,
} from "lucide-react";

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
    massedcompute: "Massed Compute",
    dc_roan: "DC Roan",
    dc_impala: "DC Impala",
    dc_kudu: "DC Kudu",
    oblivus: "Oblivus",
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

function getInstanceId(instance: GpuInstance): string {
  return [
    instance.cloudId,
    instance.provider,
    instance.region,
    instance.dataCenter,
    instance.country,
    instance.gpuType,
    instance.gpuCount,
    instance.security,
    instance.isSpot ? "spot" : "ondemand",
  ]
    .filter(Boolean)
    .join("-");
}

type SelectedGpuInstance = GpuInstance & { instanceId: string };

interface GpuAvailabilityProps {
  /** Pre-filtered instances to display */
  instances: GpuInstance[];
  gpu?: string;
  count?: string;
  selectedInstanceId?: string | null;
  onSelectInstance?: (instance: SelectedGpuInstance) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function GpuAvailability({
  instances,
  gpu,
  count,
  selectedInstanceId,
  onSelectInstance,
  isLoading = false,
  onRefresh,
}: GpuAvailabilityProps) {
  // Sort instances by price (cheapest first)
  const sortedInstances = useMemo(() => {
    return [...instances].sort((a, b) => {
      const priceA = a.prices.onDemand ?? a.prices.communityPrice ?? Infinity;
      const priceB = b.prices.onDemand ?? b.prices.communityPrice ?? Infinity;
      return priceA - priceB;
    });
  }, [instances]);

  if (!gpu || !count) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">
            Available Instances
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a GPU configuration on the left to view available instances and
          pricing details.
        </p>
      </div>
    );
  }

  const displayName = gpu.replace(/_/g, " ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg md:text-xl font-semibold">
          Available Instances
        </h2>
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span className="text-sm text-muted-foreground">
            ({sortedInstances.length} available)
          </span>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCwIcon className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`instance-skeleton-${index}`}
              className="h-40 border border-border bg-accent/40 animate-pulse"
            />
          ))}
        </div>
      ) : sortedInstances.length === 0 ? (
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No instances available for {displayName} x {count}
          </p>
        </div>
      ) : (
        <div className="max-h-[600px] md:h-[calc(100vh-260px)] overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedInstances.map((instance, index) => {
              const price =
                instance.prices.onDemand ?? instance.prices.communityPrice;
              const instanceId = getInstanceId(instance);
              const instanceKey = `${instanceId}-${index}`;
              const isSelected = instanceId === selectedInstanceId;

              return (
                <div
                  key={instanceKey}
                  className={cn(
                    "p-4 border border-border/90 bg-transparent transition-colors cursor-pointer",
                    !isSelected && "hover:border-border hover:bg-accent/40",
                    isSelected && "border-primary/70 bg-primary/20"
                  )}
                  data-instance-index={index}
                  onClick={() => {
                    onSelectInstance?.({ ...instance, instanceId });
                  }}
                >
                  <div className="space-y-4">
                    <div className="space-y-3 lg:flex lg:items-start lg:justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 lg:block">
                          <div className="space-y-1">
                            <div className="flex flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-2">
                              <h3 className="font-bold text-base md:text-lg break-words">
                                {formatGpuName(instance.gpuType)} x
                                {instance.gpuCount}
                              </h3>

                              <span className="flex items-center text-xs md:text-sm text-muted-foreground">
                                {getCountryFlag(instance.country)}{" "}
                                {instance.dataCenter || instance.country}
                              </span>
                            </div>
                          </div>
                          <div className="text-right lg:hidden">
                            <p className="text-xs text-muted-foreground">
                              {getProviderDisplayName(instance.provider)}
                            </p>
                            <p className="text-xl md:text-2xl font-bold mt-1">
                              ${price?.toFixed(2) || "N/A"}
                              <span className="text-xs md:text-sm font-normal text-muted-foreground ml-1">
                                /hr
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {instance.isSpot && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/20 text-amber-400 border-amber-500/50"
                            >
                              <ZapIcon className="size-3" />
                              SPOT
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="bg-muted/50 border-muted-foreground/30"
                          >
                            {instance.socket}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-sky-500/10 text-sky-400 border-sky-500/30"
                          >
                            <ShieldCheckIcon className="size-3" />
                            {instance.security
                              .toUpperCase()
                              .replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="hidden text-right lg:block lg:flex-shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {getProviderDisplayName(instance.provider)}
                        </p>
                        <p className="text-xl md:text-2xl font-bold mt-1">
                          ${price?.toFixed(2) || "N/A"}
                          <span className="text-xs md:text-sm font-normal text-muted-foreground ml-1">
                            /hr
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ServerIcon className="size-3 md:size-4" />
                          <span className="text-xs md:text-sm">CPU</span>
                        </div>
                        <p className="font-medium text-sm md:text-base">
                          {instance.vcpu?.defaultCount || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Database className="size-3 md:size-4" />
                          <span className="text-xs md:text-sm">Memory</span>
                        </div>
                        <p className="font-medium text-sm md:text-base">
                          {instance.memory?.defaultCount || "N/A"}{" "}
                          <span className="text-muted-foreground text-xs md:text-sm">
                            GB
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <HardDrive className="size-3 md:size-4" />
                          <span className="text-xs md:text-sm">
                            Disk size
                          </span>
                        </div>
                        <p className="font-medium text-sm md:text-base">
                          {instance.disk?.defaultCount || "N/A"}{" "}
                          <span className="text-muted-foreground text-xs md:text-sm">
                            GB
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
