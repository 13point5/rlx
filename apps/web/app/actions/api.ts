"use server";

import { auth } from "@clerk/nextjs/server";
import axios, { AxiosError } from "axios";
import type { GitHubOwner, GitHubRepo, Project } from "@/lib/types";

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
