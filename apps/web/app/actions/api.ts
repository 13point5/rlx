"use server";

import { auth } from "@clerk/nextjs/server";
import axios, { AxiosError } from "axios";
import type {
  GitHubOwner,
  GitHubRepo,
  GpuSummaryData,
  GpuAvailabilityResponse,
  Project,
  RunInstanceSelection,
  RunRecord,
  RunStatusResponse,
  RunTerminateResponse,
  RunStatusBatchResponse,
  SSHKeyStatus,
  SSHKeyResponse,
} from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

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

// =============================================================================
// Project Actions
// =============================================================================

export async function getGpuAvailability(params?: {
  page?: number;
  page_size?: number;
  regions?: string[];
  gpu_type?: string;
  gpu_count?: number;
  socket?: string;
  security?: string;
}): Promise<{
  success: boolean;
  data?: GpuAvailabilityResponse;
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
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    if (params?.gpu_type) searchParams.set("gpu_type", params.gpu_type);
    if (params?.gpu_count) searchParams.set("gpu_count", params.gpu_count.toString());
    if (params?.socket) searchParams.set("socket", params.socket);
    if (params?.security) searchParams.set("security", params.security);
    params?.regions?.forEach((region) => searchParams.append("regions", region));

    const url = `${API_BASE_URL}/api/compute/availability/gpus${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error getting GPU availability:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getGpuSummary(): Promise<{
  success: boolean;
  data?: GpuSummaryData;
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

    const response = await axios.get(`${API_BASE_URL}/api/compute/availability/gpu-summary`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error getting GPU summary:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: detail || `API error: ${error.response?.status || error.message}`,
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
  const { getToken, userId } = await auth();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const token = await getToken();

    if (!token) {
      return { success: false, error: "Could not get session token" };
    }

    const response = await axios.get(`${API_BASE_URL}/api/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      success: true,
      projects: response.data.projects,
    };
  } catch (error) {
    console.error("Error getting projects:", error);

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

export async function getProject(id: number): Promise<{
  success: boolean;
  project?: Project;
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

    const response = await axios.get(`${API_BASE_URL}/api/projects/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, project: response.data };
  } catch (error) {
    console.error("Error getting project:", error);

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

export async function createProject(repoUrl: string): Promise<{
  success: boolean;
  project?: Project;
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
      `${API_BASE_URL}/api/projects`,
      { repo_url: repoUrl },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true, project: response.data };
  } catch (error) {
    console.error("Error creating project:", error);

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

export async function deleteProject(id: number): Promise<{
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

    await axios.delete(`${API_BASE_URL}/api/projects/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting project:", error);

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

export async function startRun(input: {
  projectId: number;
  name: string;
  branch: string;
  config: string;
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
        config_path: input.config,
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
        error: detail || `API error: ${error.response?.status || error.message}`,
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
        error: detail || `API error: ${error.response?.status || error.message}`,
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

    const response = await axios.get(`${API_BASE_URL}/api/runs/${runId}/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
        error: detail || `API error: ${error.response?.status || error.message}`,
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
        error: detail || `API error: ${error.response?.status || error.message}`,
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
        error: detail || `API error: ${error.response?.status || error.message}`,
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
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
    
    // Ed25519 public key in OpenSSH format
    const keyType = "ssh-ed25519";
    const keyData = sshPublicKey.subarray(12); // Skip the SPKI header for Ed25519
    const opensshPublicKey = `${keyType} ${keyData.toString("base64")} rlx-generated`;

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
      error: error instanceof Error ? error.message : "Failed to generate key pair",
    };
  }
}

export async function getSSHKeyStatus(): Promise<{
  success: boolean;
  data?: SSHKeyStatus;
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

    const response = await axios.get(`${API_BASE_URL}/api/ssh-keys`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error getting SSH key status:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function uploadSSHKey(
  publicKey: string,
  privateKey: string
): Promise<{
  success: boolean;
  data?: SSHKeyResponse;
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
      `${API_BASE_URL}/api/ssh-keys`,
      {
        public_key: publicKey,
        private_key: privateKey,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error uploading SSH key:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteSSHKey(keyId: number): Promise<{
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

    await axios.delete(`${API_BASE_URL}/api/ssh-keys/${keyId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting SSH key:", error);

    if (error instanceof AxiosError) {
      const detail = error.response?.data?.detail;
      return {
        success: false,
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

