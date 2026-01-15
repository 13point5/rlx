"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GpuSummaryData, GpuSummaryPrice } from "@/lib/types";
import { ShieldCheckIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function isPriceRecord(
  value: unknown
): value is Record<string, GpuSummaryPrice> {
  return typeof value === "object" && value !== null;
}

interface Props {
  summary: GpuSummaryData;
  selectedGpu?: string;
  selectedCount?: string;
}

type GpuSummaryCardProps = {
  gpuType: string;
  counts: Record<string, unknown>;
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
  const countEntries = Object.entries(counts).filter(
    ([, value]) => typeof value === "object"
  );

  const cheapest = (() => {
    const value = counts[selectedCount];
    if (!isPriceRecord(value)) return null;
    return value["cheapest"] as GpuSummaryPrice | undefined;
  })();

  const displayName = gpuType.replace(/_/g, " ");

  return (
    <Card
      className={cn(
        "p-3 gap-3 rounded-sm w-full cursor-pointer transition-colors hover:bg-accent/50",
        isSelected && "border-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-0">
        <CardTitle className="text-md font-semibold">{displayName}</CardTitle>
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
          <ZapIcon className="size-3 text-amber-400" />
          <span className="text-amber-400">Spot</span>
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

export function GpuSelection({ summary, selectedGpu, selectedCount }: Props) {
  const router = useRouter();
  const entries = useMemo(() => Object.entries(summary || {}), [summary]);

  // Get first GPU and count as defaults
  const firstGpuType = entries[0]?.[0];
  const firstGpuCounts = entries[0]?.[1] as Record<string, unknown>;
  const firstCountKey = firstGpuCounts
    ? Object.entries(firstGpuCounts).filter(
        ([, v]) => typeof v === "object"
      )[0]?.[0]
    : undefined;

  // Use props or defaults
  const selectedGpuType = selectedGpu || firstGpuType || "";
  const selectedGpuCount = selectedCount || firstCountKey || "";

  // Local state for each card's count selection
  const [cardCounts, setCardCounts] = useState<Record<string, string>>({});

  const updateUrl = (gpu: string, count: string) => {
    router.push(`?gpu=${gpu}&count=${count}`, { scroll: false });
  };

  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No GPU summary data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Select GPU</h2>
      <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
        {entries.map(([gpuType, counts]) => {
          const countsRecord = counts as Record<string, unknown>;
          const countEntries = Object.entries(countsRecord).filter(
            ([, value]) => typeof value === "object"
          );
          const defaultCount = countEntries[0]?.[0] || "";

          // Use card-specific count if set, otherwise use URL count if this card is selected, otherwise use default
          const effectiveCount =
            cardCounts[gpuType] ||
            (gpuType === selectedGpuType ? selectedGpuCount : defaultCount);

          const isSelected = gpuType === selectedGpuType;

          return (
            <GpuSummaryCard
              key={gpuType}
              gpuType={gpuType}
              counts={countsRecord}
              selectedCount={effectiveCount}
              onSelectCount={(val) => {
                setCardCounts((prev) => ({ ...prev, [gpuType]: val }));
                updateUrl(gpuType, val);
              }}
              isSelected={isSelected}
              onClick={() => updateUrl(gpuType, effectiveCount)}
            />
          );
        })}
      </div>
    </div>
  );
}
