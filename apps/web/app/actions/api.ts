"use server";

import { auth } from "@clerk/nextjs/server";
import axios, { AxiosError } from "axios";

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
