"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Link as LinkIcon, Loader2, AlertCircle, ChevronDown, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createProject,
  getGitHubRepos,
  getGitHubOwners,
  type GitHubRepo,
  type GitHubOwner,
} from "@/app/actions/api";
import { Skeleton } from "@/components/ui/skeleton";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owners state
  const [owners, setOwners] = useState<GitHubOwner[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<GitHubOwner | null>(null);
  const [isLoadingOwners, setIsLoadingOwners] = useState(true);
  const [ownersError, setOwnersError] = useState<string | null>(null);

  // Repos state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch owners on mount
  useEffect(() => {
    async function fetchOwners() {
      setIsLoadingOwners(true);
      const result = await getGitHubOwners();

      if (!result.success) {
        setOwnersError(result.error ?? "Failed to load GitHub account");
        setIsLoadingOwners(false);
        return;
      }

      const ownersList = result.owners ?? [];
      setOwners(ownersList);

      // Select the first owner (the user) by default
      if (ownersList.length > 0) {
        setSelectedOwner(ownersList[0]);
      }

      setIsLoadingOwners(false);
    }

    fetchOwners();
  }, []);

  // Fetch repos when owner changes or search query changes
  const fetchRepos = useCallback(
    async (searchTerm: string, pageNum: number, append: boolean = false) => {
      if (!selectedOwner) return;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingRepos(true);
        setReposError(null);
      }

      const result = await getGitHubRepos({
        page: pageNum,
        per_page: 25,
        search: searchTerm || undefined,
        owner: selectedOwner.login,
      });

      if (!result.success) {
        setReposError(result.error ?? "Failed to load repositories");
        setIsLoadingRepos(false);
        setIsLoadingMore(false);
        return;
      }

      if (append) {
        setRepos((prev) => [...prev, ...(result.data?.repos ?? [])]);
      } else {
        setRepos(result.data?.repos ?? []);
      }

      setPage(pageNum);
      setHasMore(result.data?.has_more ?? false);
      setIsLoadingRepos(false);
      setIsLoadingMore(false);
    },
    [selectedOwner]
  );

  // Fetch repos when owner is selected
  useEffect(() => {
    if (selectedOwner) {
      setSearchQuery("");
      fetchRepos("", 1);
    }
  }, [selectedOwner, fetchRepos]);

  // Fetch repos when debounced search query changes
  useEffect(() => {
    if (selectedOwner) {
      fetchRepos(debouncedSearchQuery, 1);
    }
  }, [debouncedSearchQuery, selectedOwner, fetchRepos]);

  const handleLoadMore = () => {
    fetchRepos(debouncedSearchQuery, page + 1, true);
  };

  const handleImport = async (repoUrl: string) => {
    setIsCreating(true);
    setError(null);

    const result = await createProject(repoUrl);

    if (!result.success) {
      setError(result.error ?? "Failed to create project");
      setIsCreating(false);
      return;
    }

    router.push(`/projects/${result.project!.id}`);
  };

  const handleUrlSubmit = async () => {
    await handleImport(repoUrl);
  };

  const handleRepoImport = async (repo: GitHubRepo) => {
    await handleImport(repo.html_url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Start a new RL project
          </h1>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* URL Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter a Git repository URL..."
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="pl-9"
                disabled={isCreating}
              />
            </div>
            <Button
              disabled={!repoUrl || isCreating}
              onClick={handleUrlSubmit}
            >
              {isCreating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>

        {/* Import Git Repository */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Import Git Repository</h2>

          <div className="flex gap-2">
            {/* Owner Dropdown */}
            {isLoadingOwners ? (
              <Skeleton className="h-10 w-40" />
            ) : ownersError ? (
              <div className="flex h-10 items-center gap-2 rounded-md border bg-destructive/10 px-3 text-sm text-destructive">
                {ownersError}
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-40 justify-between">
                    {selectedOwner ? (
                      <div className="flex items-center gap-2">
                        <Image
                          src={selectedOwner.avatar_url}
                          alt={selectedOwner.login}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                        <span>{selectedOwner.login}</span>
                      </div>
                    ) : (
                      "Select owner"
                    )}
                    <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {owners.map((owner) => (
                    <DropdownMenuItem
                      key={owner.login}
                      onClick={() => setSelectedOwner(owner)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Image
                          src={owner.avatar_url}
                          alt={owner.login}
                          width={20}
                          height={20}
                          className="rounded-full"
                        />
                        <span>{owner.login}</span>
                        {owner.type === "Organization" && (
                          <span className="text-xs text-muted-foreground">(org)</span>
                        )}
                      </div>
                      {selectedOwner?.login === owner.login && (
                        <Check className="size-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                disabled={isLoadingOwners || !selectedOwner}
              />
            </div>
          </div>

          {/* Repos List */}
          <div className="rounded-lg border">
            {isLoadingOwners || (isLoadingRepos && repos.length === 0) ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-6 rounded-full" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : ownersError ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Please connect your GitHub account first.
              </div>
            ) : reposError ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                {reposError}
              </div>
            ) : repos.length > 0 ? (
              <>
                <ul className="divide-y">
                  {repos.map((repo) => (
                    <li
                      key={repo.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={`https://github.com/${repo.full_name.split("/")[0]}.png`}
                          alt={repo.full_name.split("/")[0]}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{repo.name}</span>
                          {repo.private && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              Private
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRepoImport(repo)}
                        disabled={isCreating}
                      >
                        {isCreating ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Import"
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>

                {/* Load More Button */}
                {hasMore && (
                  <div className="border-t px-4 py-3">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-8 text-center text-muted-foreground">
                {searchQuery ? "No repositories found matching your search" : "No repositories found"}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
