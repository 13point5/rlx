import { getAllGpuAvailability } from "@/app/actions/api";
import { computeGpuSummary, type ComputedGpuSummary } from "@/lib/gpu-utils";
import type { GpuInstance } from "@/lib/types";

interface SearchParams {
  gpu?: string;
  count?: string;
}

export interface GpuDataResult {
  success: boolean;
  summary?: ComputedGpuSummary;
  instances?: GpuInstance[];
  error?: string | null;
}

export async function getNewRunData(searchParams: SearchParams) {
  // Fetch all GPU availability and compute summary ourselves
  // This matches what Prime Intellect does on their website
  const availabilityResult = await getAllGpuAvailability();
  
  let gpuDataResult: GpuDataResult;
  
  if (availabilityResult.success && availabilityResult.data) {
    const computedSummary = computeGpuSummary(availabilityResult.data);
    gpuDataResult = { 
      success: true, 
      summary: computedSummary,
      instances: availabilityResult.data,
    };
  } else {
    gpuDataResult = { 
      success: false, 
      error: availabilityResult.error || "Failed to fetch GPU availability" 
    };
  }

  // Derive default selection from computed summary
  let selectedGpu: string | undefined;
  let selectedCount: string | undefined;

  // Use URL params if provided, otherwise derive from summary
  if (searchParams.gpu && searchParams.count) {
    selectedGpu = searchParams.gpu;
    selectedCount = searchParams.count;
  } else if (gpuDataResult.success && gpuDataResult.summary) {
    const entries = Object.entries(gpuDataResult.summary);
    if (entries.length > 0) {
      selectedGpu = entries[0][0];
      const firstGpuCounts = entries[0][1];
      const countKeys = Object.keys(firstGpuCounts);
      if (countKeys.length > 0) {
        selectedCount = countKeys[0];
      }
    }
  }

  return {
    gpuDataResult,
    selectedGpu,
    selectedCount,
  };
}
