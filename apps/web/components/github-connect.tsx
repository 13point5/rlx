"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getGitHubAuthUrl,
  getGitHubStatus,
  getGitHubRepos,
  disconnectGitHub,
} from "@/app/actions/api";
import type { GitHubRepo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GitHubIcon } from "@/components/icons";

type ConnectionState =
  | "loading"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export function GitHubConnect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ConnectionState>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Check for OAuth callback params
  useEffect(() => {
    const githubParam = searchParams.get("github");
    const messageParam = searchParams.get("message");

    if (githubParam === "connected") {
      // Clear URL params
      router.replace("/home", { scroll: false });
      checkConnectionStatus();
    } else if (githubParam === "error") {
      setState("error");
      setError(messageParam || "Failed to connect to GitHub");
      router.replace("/home", { scroll: false });
    } else {
      checkConnectionStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkConnectionStatus() {
    setState("loading");
    const result = await getGitHubStatus();

    if (!result.success) {
      setState("error");
      setError(result.error || "Failed to check connection status");
      return;
    }

    if (result.connected) {
      setState("connected");
      setUsername(result.username || null);
      fetchRepos();
    } else {
      setState("disconnected");
    }
  }

  async function fetchRepos() {
    setIsLoadingRepos(true);
    const result = await getGitHubRepos();

    if (result.success && result.data?.repos) {
      setRepos(result.data.repos);
    } else if (
      result.error?.includes("expired") ||
      result.error?.includes("401")
    ) {
      setState("disconnected");
      setError("Your GitHub connection has expired. Please reconnect.");
    }
    setIsLoadingRepos(false);
  }

  async function handleConnect() {
    setState("connecting");
    const result = await getGitHubAuthUrl("/home");

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
      setRepos([]);
    } else {
      setError(result.error || "Failed to disconnect");
    }
  }

  function handleRetry() {
    setError(null);
    checkConnectionStatus();
  }

  // Loading state
  if (state === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Disconnected state
  if (state === "disconnected") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            GitHub
          </CardTitle>
          <CardDescription>
            Connect your GitHub account to see your repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleConnect} className="w-full">
            Connect to GitHub
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connecting state
  if (state === "connecting") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Redirecting to GitHub...
          </p>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Connected state
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            GitHub
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            className="text-muted-foreground hover:text-destructive"
          >
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connected as{" "}
          <span className="font-medium text-foreground">@{username}</span>
        </p>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Repositories</h4>
          {isLoadingRepos ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : repos.length > 0 ? (
            <ul className="space-y-2">
              {repos.map((repo) => (
                <li key={repo.id}>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-none border p-3 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{repo.name}</span>
                      {repo.private && (
                        <span className="text-xs text-muted-foreground">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {repo.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {repo.language && <span>{repo.language}</span>}
                      <span>⭐ {repo.stargazers_count}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No repositories found.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
