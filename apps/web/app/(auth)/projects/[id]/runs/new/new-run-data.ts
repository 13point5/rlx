import { getAllGpuAvailability, getProjectBranches } from "@/app/actions/api";
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

export interface BranchesDataResult {
  success: boolean;
  branches: string[];
  hasMore: boolean;
  error?: string | null;
}

export async function getNewRunData(searchParams: SearchParams, projectId: number) {
  // Fetch GPU availability and branches in parallel
  const [availabilityResult, branchesResult] = await Promise.all([
    getAllGpuAvailability(),
    getProjectBranches({ projectId, page: 1, per_page: 100 }),
  ]);
  
  // Process GPU data
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

  // Process branches data
  let branchesDataResult: BranchesDataResult;
  
  if (branchesResult.success && branchesResult.data) {
    branchesDataResult = {
      success: true,
      branches: branchesResult.data.branches,
      hasMore: branchesResult.data.has_more,
    };
  } else {
    branchesDataResult = {
      success: false,
      branches: [],
      hasMore: false,
      error: branchesResult.error || "Failed to fetch branches",
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
    branchesDataResult,
    selectedGpu,
    selectedCount,
  };
}
