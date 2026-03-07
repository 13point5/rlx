import {
  getAllGpuAvailability,
  getProjectBranches,
  getProject,
  getProjectRlxConfig,
} from "@/app/actions/api";
import { computeGpuSummary, type ComputedGpuSummary } from "@/lib/gpu-utils";
import type { GpuInstance, Project, RlxConfigEntry } from "@/lib/types";

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

export interface ProjectDataResult {
  success: boolean;
  project?: Project;
  error?: string | null;
}

export interface ConfigsDataResult {
  success: boolean;
  configs: RlxConfigEntry[];
  found: boolean;
  error?: string | null;
}

function getInitialBranch(branchesDataResult: BranchesDataResult) {
  if (branchesDataResult.success && branchesDataResult.branches.length > 0) {
    const defaultBranchName = branchesDataResult.branches.includes("main")
      ? "main"
      : branchesDataResult.branches[0];

    return `origin/${defaultBranchName}`;
  }

  return "origin/main";
}

export async function getNewRunData(
  searchParams: SearchParams,
  projectId: number
) {
  // Fetch GPU availability, branches, and project in parallel
  const [availabilityResult, branchesResult, projectResult] = await Promise.all(
    [
      getAllGpuAvailability(),
      getProjectBranches({ projectId, page: 1, per_page: 100 }),
      getProject(projectId),
    ]
  );

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
      error: availabilityResult.error || "Failed to fetch GPU availability",
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

  const initialBranch = getInitialBranch(branchesDataResult);
  const configBranch = initialBranch.startsWith("origin/")
    ? initialBranch.slice(7)
    : initialBranch;
  const configsResult = await getProjectRlxConfig({
    projectId,
    branch: configBranch,
  });

  let configsDataResult: ConfigsDataResult;

  if (configsResult.success && configsResult.data) {
    configsDataResult = {
      success: true,
      configs: configsResult.data.configs,
      found: configsResult.data.found,
    };
  } else {
    configsDataResult = {
      success: false,
      configs: [],
      found: false,
      error: configsResult.error || "Failed to fetch configs",
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

  // Process project data
  let projectDataResult: ProjectDataResult;

  if (projectResult.success && projectResult.project) {
    projectDataResult = {
      success: true,
      project: projectResult.project,
    };
  } else {
    projectDataResult = {
      success: false,
      error: projectResult.error || "Failed to fetch project",
    };
  }

  return {
    gpuDataResult,
    branchesDataResult,
    configsDataResult,
    projectDataResult,
    initialBranch,
    selectedGpu,
    selectedCount,
  };
}
