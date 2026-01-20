"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ComputedGpuSummary,
  ComputedGpuCountData,
  ComputedGpuPrice,
} from "@/lib/gpu-utils";
import { ShieldCheckIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  summary: ComputedGpuSummary;
  selectedGpu?: string;
  selectedCount?: string;
  onSelectionChange?: (gpu: string, count: string) => void;
}

type GpuSummaryCardProps = {
  gpuType: string;
  counts: Record<string, ComputedGpuCountData>;
  selectedCount: string;
  onSelectCount: (val: string) => void;
  isSelected: boolean;
  onClick: () => void;
};

function GpuSummaryCard({
  gpuType,
  counts,
  selectedCount,
  onSelectCount,
  isSelected,
  onClick,
}: GpuSummaryCardProps) {
  const countEntries = Object.entries(counts);

  const cheapest: ComputedGpuPrice | null = (() => {
    const countData = counts[selectedCount];
    if (!countData) return null;
    return countData.cheapest;
  })();

  const displayName = gpuType.replace(/_/g, " ");

  return (
    <Card
      className={cn(
        "p-3 gap-3 w-full cursor-pointer border border-border/90 bg-transparent transition-colors",
        !isSelected && "hover:border-border hover:bg-accent/40",
        isSelected && "border-primary/70 bg-primary/20"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 px-0">
        <CardTitle className="min-w-0 text-md font-semibold">
          {displayName}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {countEntries.length > 1 && (
            <Select value={selectedCount} onValueChange={onSelectCount}>
              <SelectTrigger
                className="w-20"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Count" />
              </SelectTrigger>
              <SelectContent>
                {countEntries.map(([countKey]) => (
                  <SelectItem key={countKey} value={countKey}>
                    {countKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-6 px-0 text-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <ZapIcon className="size-3 text-amber-400" />
            <span className="text-amber-400">Spot</span>
          </div>

          <span>
            {cheapest?.spotPrice !== null && cheapest?.spotPrice !== undefined
              ? `$${cheapest.spotPrice.toFixed(2)}`
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-3 text-sky-400" />
          <span className="text-sky-400">Secure</span>
          <span>
            {cheapest?.onDemand !== null && cheapest?.onDemand !== undefined
              ? `$${cheapest.onDemand.toFixed(2)}`
              : "N/A"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function GpuSelection({
  summary,
  selectedGpu,
  selectedCount,
  onSelectionChange,
}: Props) {
  const router = useRouter();
  const entries = useMemo(() => Object.entries(summary || {}), [summary]);

  const getCountEntries = (
    countsRecord: Record<string, ComputedGpuCountData>
  ) => Object.entries(countsRecord);

  // Get first GPU and count as defaults
  const firstGpuType = entries[0]?.[0];
  const firstGpuCounts = entries[0]?.[1];
  const firstCountKey = firstGpuCounts
    ? getCountEntries(firstGpuCounts)[0]?.[0]
    : undefined;

  // Use props or defaults
  const selectedGpuType = selectedGpu || firstGpuType || "";
  const selectedGpuCount = selectedCount || firstCountKey || "";

  const [pendingSelection, setPendingSelection] = useState<{
    gpu: string;
    count: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  // Local state for each card's count selection
  const [cardCounts, setCardCounts] = useState<Record<string, string>>({});

  const hasPendingSelection = Boolean(pendingSelection);
  const isPendingSelection =
    hasPendingSelection &&
    (pendingSelection!.gpu !== selectedGpuType ||
      pendingSelection!.count !== selectedGpuCount);
  const optimisticGpu = isPendingSelection
    ? pendingSelection!.gpu
    : selectedGpuType;
  const optimisticCount = isPendingSelection
    ? pendingSelection!.count
    : selectedGpuCount;

  const selectedEntry = entries.find(([gpuType]) => gpuType === optimisticGpu);
  const selectedCountsRecord = selectedEntry?.[1] ?? firstGpuCounts;
  const selectedCountEntries = selectedCountsRecord
    ? getCountEntries(selectedCountsRecord)
    : [];
  const selectedDefaultCount = selectedCountEntries[0]?.[0] || "";
  const selectedEffectiveCount =
    cardCounts[optimisticGpu] || optimisticCount || selectedDefaultCount;

  // Sync URL with default selection on mount (without navigation flash)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasGpuInUrl = params.has("gpu");

    if (!hasGpuInUrl && selectedGpuType && selectedGpuCount) {
      router.replace(`?gpu=${selectedGpuType}&count=${selectedGpuCount}`, {
        scroll: false,
      });
    }
  }, [selectedGpuType, selectedGpuCount, router]);

  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No GPU summary data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 md:block">
        <h2 className="text-lg md:text-xl font-semibold">Select GPU</h2>
        <div className="md:hidden">
          <Select
            value={optimisticGpu}
            onValueChange={(gpuType) => {
              const countsRecord = entries.find(
                ([type]) => type === gpuType
              )?.[1];
              const countEntries = countsRecord
                ? getCountEntries(countsRecord)
                : [];
              const defaultCount = countEntries[0]?.[0] || "";
              const effectiveCount = cardCounts[gpuType] || defaultCount;

              setPendingSelection({ gpu: gpuType, count: effectiveCount });
              onSelectionChange?.(gpuType, effectiveCount);
              startTransition(() => {
                router.push(`?gpu=${gpuType}&count=${effectiveCount}`, {
                  scroll: false,
                });
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select GPU" />
            </SelectTrigger>
            <SelectContent>
              {entries.map(([gpuType]) => (
                <SelectItem key={gpuType} value={gpuType}>
                  {gpuType.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-4 md:hidden">
        {selectedCountsRecord && (
          <GpuSummaryCard
            gpuType={optimisticGpu}
            counts={selectedCountsRecord}
            selectedCount={selectedEffectiveCount}
            onSelectCount={(val) => {
              setCardCounts((prev) => ({ ...prev, [optimisticGpu]: val }));
              setPendingSelection({ gpu: optimisticGpu, count: val });
              onSelectionChange?.(optimisticGpu, val);
              startTransition(() => {
                router.push(`?gpu=${optimisticGpu}&count=${val}`, {
                  scroll: false,
                });
              });
            }}
            isSelected
            onClick={() => {
              setPendingSelection({
                gpu: optimisticGpu,
                count: selectedEffectiveCount,
              });
              onSelectionChange?.(optimisticGpu, selectedEffectiveCount);
              startTransition(() => {
                router.push(
                  `?gpu=${optimisticGpu}&count=${selectedEffectiveCount}`,
                  { scroll: false }
                );
              });
            }}
          />
        )}
      </div>
      <div className="hidden md:block max-h-[600px] md:h-[calc(100vh-260px)] overflow-y-auto space-y-4 pr-1">
        {entries.map(([gpuType, counts]) => {
          const countEntries = getCountEntries(counts);
          const defaultCount = countEntries[0]?.[0] || "";

          // Use card-specific count if set, otherwise use URL count if this card is selected, otherwise use default
          const effectiveCount =
            cardCounts[gpuType] ||
            (gpuType === optimisticGpu ? optimisticCount : defaultCount);

          const isSelected = gpuType === optimisticGpu;

          return (
            <GpuSummaryCard
              key={gpuType}
              gpuType={gpuType}
              counts={counts}
              selectedCount={effectiveCount}
              onSelectCount={(val) => {
                setCardCounts((prev) => ({ ...prev, [gpuType]: val }));
                setPendingSelection({ gpu: gpuType, count: val });
                onSelectionChange?.(gpuType, val);
                startTransition(() => {
                  router.push(`?gpu=${gpuType}&count=${val}`, {
                    scroll: false,
                  });
                });
              }}
              isSelected={isSelected}
              onClick={() => {
                setPendingSelection({ gpu: gpuType, count: effectiveCount });
                onSelectionChange?.(gpuType, effectiveCount);
                startTransition(() => {
                  router.push(`?gpu=${gpuType}&count=${effectiveCount}`, {
                    scroll: false,
                  });
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
