"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getGitHubAuthUrl,
  getGitHubStatus,
  disconnectGitHub,
} from "@/app/actions/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Github } from "lucide-react";

type ConnectionState = "loading" | "disconnected" | "connecting" | "connected" | "error";

export function GitHubSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ConnectionState>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback params
  useEffect(() => {
    const githubParam = searchParams.get("github");
    const messageParam = searchParams.get("message");

    if (githubParam === "connected") {
      checkConnectionStatus().then(() => {
        router.replace("/settings", { scroll: false });
      });
    } else if (githubParam === "error") {
      setState("error");
      setError(messageParam || "Failed to connect to GitHub");
      router.replace("/settings", { scroll: false });
    } else {
      checkConnectionStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkConnectionStatus() {
    setState("loading");
    try {
      const result = await getGitHubStatus();

      if (!result.success) {
        setState("error");
        setError(result.error || "Failed to check connection status");
        return;
      }

      if (result.connected) {
        setState("connected");
        setUsername(result.username || null);
      } else {
        setState("disconnected");
      }
    } catch (err) {
      console.error("Error checking GitHub status:", err);
      setState("error");
      setError("Failed to check connection status");
    }
  }

  async function handleConnect() {
    setState("connecting");
    const result = await getGitHubAuthUrl("/settings");

    if (result.success && result.authorization_url) {
      window.location.href = result.authorization_url;
    } else {
      setState("error");
      setError(result.error || "Failed to get authorization URL");
    }
  }

  async function handleDisconnect() {
    const result = await disconnectGitHub();

    if (result.success) {
      setState("disconnected");
      setUsername(null);
    } else {
      setError(result.error || "Failed to disconnect");
    }
  }

  if (state === "loading") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="size-5 text-destructive" />
            Error
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => checkConnectionStatus()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "connected") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="size-5" />
            GitHub Connected
          </CardTitle>
          <CardDescription>
            Connected as <span className="font-medium text-foreground">{username}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="size-5" />
          GitHub
        </CardTitle>
        <CardDescription>
          Connect your GitHub account to import repositories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleConnect} disabled={state === "connecting"}>
          {state === "connecting" ? "Connecting..." : "Connect GitHub"}
        </Button>
      </CardContent>
    </Card>
  );
}
