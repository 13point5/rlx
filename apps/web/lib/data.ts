import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import axios, { AxiosError } from "axios";
import type { Project } from "@/lib/types";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

// Cached getProject - dedupes calls within a single request
export const getProject = cache(async (id: number): Promise<{
  success: boolean;
  project?: Project;
  error?: string;
}> => {
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
        error: detail || `API error: ${error.response?.status || error.message}`,
      };
    }

    return { success: false, error: "Unknown error occurred" };
  }
});
