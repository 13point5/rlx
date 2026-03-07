"use server";

import { auth } from "@clerk/nextjs/server";
import axios, { AxiosError } from "axios";
import type {
  GitHubOwner,
  GitHubRepo,
  GitHubBranchesResponse,
  GpuAvailabilityResponse,
  GpuInstance,
  JobResponse,
  JobDetailResponse,
  Project,
  RlxConfigResponse,
  RunInstanceSelection,
  RunRecord,
  RunStatusResponse,
  RunTerminateResponse,
  RunStatusBatchResponse,
  SSHKeyStatus,
  SSHKeyResponse,
  WandbKeyStatus,
} from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract error message from various error types.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    // Handle Pydantic validation errors (array format)
    if (Array.isArray(detail)) {
      return detail.map((err: { msg?: string }) => err.msg || JSON.stringify(err)).join(", ");
    }
    if (typeof detail === "string") {
      return detail;
    }
    if (detail) {
      return JSON.stringify(detail);
    }
    return `API error: ${error.response?.status || error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

/**
 * Result type for authenticated requests.
 */
type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Wrapper for authenticated API requests.
 * Handles auth check, token retrieval, and error extraction.
 */
async function authenticatedRequest<T>(
  requestFn: (token: string) => Promise<T>
): Promise<ApiResult<T>> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();
    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const data = await requestFn(token);
    return { success: true, data };
  } catch (error) {
    console.error("API request error:", error);
    return { success: false, error: extractErrorMessage(error) };
  }
}

/**
 * Server action to fetch the secret from the Python API.
 * This runs on the server and is never cached.
 */
export async function getSecretFromAPI(): Promise<{
  success: boolean;
  data?: {
    secret: string;
    user_id: string;
    message: string;
  };
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Get the session token to send to the backend
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/secret`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error calling API:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// GitHub Actions
// =============================================================================

export async function getGitHubAuthUrl(redirectTo: string): Promise<{
  success: boolean;
  authorization_url?: string;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/github/authorize`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        redirect_to: redirectTo,
      },
    });

    return {
      success: true,
      authorization_url: response.data.authorization_url,
    };
  } catch (error) {
    console.error("Error getting GitHub auth URL:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getGitHubStatus(): Promise<{
  success: boolean;
  connected?: boolean;
  username?: string;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/github/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      success: true,
      connected: response.data.connected,
      username: response.data.username,
    };
  } catch (error) {
    console.error("Error getting GitHub status:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getGitHubOwners(): Promise<{
  success: boolean;
  owners?: GitHubOwner[];
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/github/owners`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, owners: response.data.owners };
  } catch (error) {
    console.error("Error getting GitHub owners:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export type GitHubReposResponse = {
  repos: GitHubRepo[];
  page: number;
  per_page: number;
  has_more: boolean;
  username: string | null;
};

export async function getGitHubRepos(options?: {
  page?: number;
  per_page?: number;
  search?: string;
  owner?: string;
}): Promise<{
  success: boolean;
  data?: GitHubReposResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const params = new URLSearchParams();
    if (options?.page) params.set("page", options.page.toString());
    if (options?.per_page) params.set("per_page", options.per_page.toString());
    if (options?.search) params.set("search", options.search);
    if (options?.owner) params.set("owner", options.owner);

    const url = `${API_BASE_URL}/api/github/repos${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      success: true,
      data: {
        repos: response.data.repos,
        page: response.data.page,
        per_page: response.data.per_page,
        has_more: response.data.has_more,
        username: response.data.username,
      },
    };
  } catch (error) {
    console.error("Error getting GitHub repos:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function disconnectGitHub(): Promise<{
  success: boolean;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    await axios.post(
      `${API_BASE_URL}/api/github/disconnect`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true };
  } catch (error) {
    console.error("Error disconnecting GitHub:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjectBranches(options: {
  projectId: number;
  page?: number;
  per_page?: number;
}): Promise<{
  success: boolean;
  data?: GitHubBranchesResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const params = new URLSearchParams();
    if (options.page) params.set("page", options.page.toString());
    if (options.per_page) params.set("per_page", options.per_page.toString());

    const url = `${API_BASE_URL}/api/github/projects/${options.projectId}/branches${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      success: true,
      data: {
        branches: response.data.branches,
        page: response.data.page,
        per_page: response.data.per_page,
        has_more: response.data.has_more,
      },
    };
  } catch (error) {
    console.error("Error fetching project branches:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjectRlxConfig(options: {
  projectId: number;
  branch?: string;
}): Promise<{
  success: boolean;
  data?: RlxConfigResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const params = new URLSearchParams();
    if (options.branch) params.set("branch", options.branch);

    const url = `${API_BASE_URL}/api/github/projects/${options.projectId}/rlx-config${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      success: true,
      data: {
        configs: response.data.configs,
        found: response.data.found,
      },
    };
  } catch (error) {
    console.error("Error fetching project rlx config:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// GPU Availability Actions
// =============================================================================

/**
 * Fetch ALL GPU availability data by paginating through all pages.
 * This matches what Prime Intellect does on their website.
 * 
 * Optimized: Fetches page 1 first to get total count, then fetches
 * all remaining pages in parallel for faster loading.
 */
export async function getAllGpuAvailability(): Promise<{
  success: boolean;
  data?: GpuInstance[];
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const pageSize = 100; // Max allowed by /gpus endpoint (legacy /availability allows 500)
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch first page to get total count
    const firstPageUrl = `${API_BASE_URL}/api/compute/availability/gpus?page=1&page_size=${pageSize}`;
    const firstResponse = await axios.get(firstPageUrl, { headers });
    const firstData = firstResponse.data as GpuAvailabilityResponse;

    const totalCount = firstData.totalCount;
    const totalPages = Math.ceil(totalCount / pageSize);

    // If only one page, return immediately
    if (totalPages <= 1) {
      return { success: true, data: firstData.items };
    }

    // Fetch remaining pages in parallel
    const remainingPageNumbers = Array.from(
      { length: totalPages - 1 },
      (_, i) => i + 2
    );

    const remainingRequests = remainingPageNumbers.map((page) => {
      const url = `${API_BASE_URL}/api/compute/availability/gpus?page=${page}&page_size=${pageSize}`;
      return axios.get(url, { headers });
    });

    const remainingResponses = await Promise.all(remainingRequests);

    // Combine all items
    const allItems: GpuInstance[] = [...firstData.items];
    for (const response of remainingResponses) {
      const data = response.data as GpuAvailabilityResponse;
      allItems.push(...data.items);
    }

    return { success: true, data: allItems };
  } catch (error) {
    console.error("Error getting all GPU availability:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjects(): Promise<{
  success: boolean;
  projects?: Project[];
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { projects: response.data.projects as Project[] };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, projects: result.data.projects };
}

export async function getProject(id: number): Promise<{
  success: boolean;
  project?: Project;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/projects/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as Project;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, project: result.data };
}

export async function createProject(repoUrl: string): Promise<{
  success: boolean;
  project?: Project;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/projects`,
      { repo_url: repoUrl },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data as Project;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, project: result.data };
}

export async function deleteProject(id: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    await axios.delete(`${API_BASE_URL}/api/projects/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return null;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

export async function startRun(input: {
  projectId: number;
  name: string;
  branch: string;
  configName: string; // Selected config name from rlx.toml
  instance: RunInstanceSelection & { instanceId: string };
}): Promise<{
  success: boolean;
  runId?: number;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.post(
      `${API_BASE_URL}/api/runs`,
      {
        project_id: input.projectId,
        name: input.name,
        branch: input.branch,
        config_name: input.configName,
        instance: {
          cloud_id: input.instance.cloudId,
          gpu_type: input.instance.gpuType,
          gpu_count: input.instance.gpuCount,
          socket: input.instance.socket,
          provider: input.instance.provider,
          region: input.instance.region,
          data_center: input.instance.dataCenter,
          country: input.instance.country,
          security: input.instance.security,
          is_spot: input.instance.isSpot ?? false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true, runId: response.data.id };
  } catch (error) {
    console.error("Error starting run:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getRun(runId: number): Promise<{
  success: boolean;
  run?: RunRecord;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, run: response.data };
  } catch (error) {
    console.error("Error fetching run:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getRunStatus(runId: number): Promise<{
  success: boolean;
  status?: RunStatusResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(
      `${API_BASE_URL}/api/runs/${runId}/status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true, status: response.data };
  } catch (error) {
    console.error("Error fetching run status:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      if (detail && typeof detail === "object") {
        return {
          success: false,
          error: JSON.stringify(detail),
        };
      }
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function terminateRun(runId: number): Promise<{
  success: boolean;
  status?: RunTerminateResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.post(
      `${API_BASE_URL}/api/runs/${runId}/terminate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true, status: response.data };
  } catch (error) {
    console.error("Error terminating run:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getProjectRuns(projectId: number): Promise<{
  success: boolean;
  runs?: RunRecord[];
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/runs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        project_id: projectId,
      },
    });

    return { success: true, runs: response.data };
  } catch (error) {
    console.error("Error fetching runs:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getRunStatuses(runIds: number[]): Promise<{
  success: boolean;
  statuses?: RunStatusBatchResponse;
  error?: string;
}> {
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const searchParams = new URLSearchParams();
    runIds.forEach((runId) => searchParams.append("run_ids", runId.toString()));
    const url = `${API_BASE_URL}/api/runs/status?${searchParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, statuses: response.data };
  } catch (error) {
    console.error("Error fetching run statuses:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error:
          detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Job Actions
// =============================================================================

export async function getRunJobs(runId: number): Promise<{
  success: boolean;
  jobs?: JobResponse[];
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/jobs`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { run_id: runId },
    });
    return response.data as JobResponse[];
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, jobs: result.data };
}

export async function getJobDetails(jobId: number): Promise<{
  success: boolean;
  job?: JobDetailResponse;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as JobDetailResponse;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, job: result.data };
}

export async function retryJob(jobId: number): Promise<{
  success: boolean;
  job?: JobResponse;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/jobs/${jobId}/retry`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data as JobResponse;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, job: result.data };
}

export async function syncRunJobs(runId: number): Promise<{
  success: boolean;
  added_count?: number;
  message?: string;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/runs/${runId}/sync-jobs`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data as { added_count: number; message: string };
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return {
    success: true,
    added_count: result.data?.added_count,
    message: result.data?.message,
  };
}

// =============================================================================
// W&B API Key Actions
// =============================================================================

export async function getWandbKeyStatus(): Promise<{
  success: boolean;
  data?: WandbKeyStatus;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/wandb-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as WandbKeyStatus;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

export async function setWandbApiKey(apiKey: string): Promise<{
  success: boolean;
  data?: WandbKeyStatus;
  error?: string;
}> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { success: false, error: "API key is required" };
  }

  const result = await authenticatedRequest(async (token) => {
    await axios.post(
      `${API_BASE_URL}/api/wandb-key`,
      { api_key: trimmedKey },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return null;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: { configured: true } };
}

export async function deleteWandbApiKey(): Promise<{
  success: boolean;
  data?: WandbKeyStatus;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    await axios.delete(`${API_BASE_URL}/api/wandb-key`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return null;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: { configured: false } };
}

// =============================================================================
// SSH Key Actions
// =============================================================================

export async function generateSSHKeyPair(): Promise<{
  success: boolean;
  data?: {
    publicKey: string;
    privateKey: string;
  };
  error?: string;
}> {
  // Import crypto dynamically since this is a server action
  const { generateKeyPairSync } = await import("crypto");

  try {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    // Convert PEM to OpenSSH format for the public key
    const { createPublicKey } = await import("crypto");
    const keyObject = createPublicKey(publicKey);
    const sshPublicKey = keyObject.export({ type: "spki", format: "der" });

    // Extract the raw 32-byte Ed25519 public key from SPKI DER format
    // SPKI header for Ed25519 is 12 bytes
    const rawPublicKey = sshPublicKey.subarray(12);

    // Build proper OpenSSH wire format:
    // 4 bytes: length of "ssh-ed25519" (11) as big-endian uint32
    // 11 bytes: "ssh-ed25519"
    // 4 bytes: length of key (32) as big-endian uint32
    // 32 bytes: the public key
    const keyType = "ssh-ed25519";
    const keyTypeBytes = Buffer.from(keyType, "utf8");
    
    const opensshBuffer = Buffer.alloc(4 + keyTypeBytes.length + 4 + rawPublicKey.length);
    let offset = 0;
    
    // Write key type length (big-endian)
    opensshBuffer.writeUInt32BE(keyTypeBytes.length, offset);
    offset += 4;
    
    // Write key type
    keyTypeBytes.copy(opensshBuffer, offset);
    offset += keyTypeBytes.length;
    
    // Write public key length (big-endian)
    opensshBuffer.writeUInt32BE(rawPublicKey.length, offset);
    offset += 4;
    
    // Write public key
    rawPublicKey.copy(opensshBuffer, offset);
    
    const opensshPublicKey = `${keyType} ${opensshBuffer.toString("base64")} rlx-generated`;

    return {
      success: true,
      data: {
        publicKey: opensshPublicKey,
        privateKey,
      },
    };
  } catch (error) {
    console.error("Error generating SSH key pair:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate key pair",
    };
  }
}

export async function getSSHKeyStatus(): Promise<{
  success: boolean;
  data?: SSHKeyStatus;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.get(`${API_BASE_URL}/api/ssh-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data as SSHKeyStatus;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

export async function uploadSSHKey(
  publicKey: string,
  privateKey: string,
  name?: string
): Promise<{
  success: boolean;
  data?: SSHKeyResponse;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    const response = await axios.post(
      `${API_BASE_URL}/api/ssh-keys`,
      {
        public_key: publicKey,
        private_key: privateKey,
        ...(name && { name }),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data as SSHKeyResponse;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

export async function deleteSSHKey(keyId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await authenticatedRequest(async (token) => {
    await axios.delete(`${API_BASE_URL}/api/ssh-keys/${keyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return null;
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}
