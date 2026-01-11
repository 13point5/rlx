"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Link as LinkIcon, Loader2, AlertCircle } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createProject,
  getGitHubRepos,
  type GitHubRepo,
} from "@/app/actions/api";
import { Skeleton } from "@/components/ui/skeleton";
import { GitHubAvatar } from "@/components/github-avatar";

export default function NewProjectPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreatingUrl, setIsCreatingUrl] = useState(false);
  const [creatingRepoId, setCreatingRepoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCreating = isCreatingUrl || creatingRepoId !== null;

  // Repos state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch repos
  const fetchRepos = useCallback(
    async (searchTerm: string, pageNum: number, append: boolean = false) => {
      const result = await getGitHubRepos({
        page: pageNum,
        per_page: 25,
        search: searchTerm || undefined,
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
    []
  );

  const debouncedFetchRepos = useDebouncedCallback(
    (searchTerm: string, pageNum: number) => {
      setIsLoadingRepos(true);
      setReposError(null);
      fetchRepos(searchTerm, pageNum);
    },
    300
  );

  useEffect(() => {
    debouncedFetchRepos(searchQuery, 1);
  }, [searchQuery, debouncedFetchRepos]);

  const handleLoadMore = () => {
    setReposError(null);
    setIsLoadingMore(true);
    fetchRepos(searchQuery, page + 1, true);
  };

  const handleImport = async ({
    repoUrl,
    repoId,
  }: {
    repoUrl: string;
    repoId?: number;
  }) => {
    setError(null);

    if (repoId) {
      setCreatingRepoId(repoId);
    } else {
      setIsCreatingUrl(true);
    }

    const result = await createProject(repoUrl);

    if (!result.success) {
      setError(result.error ?? "Failed to create project");
      setIsCreatingUrl(false);
      setCreatingRepoId(null);
      return;
    }

    setIsCreatingUrl(false);
    setCreatingRepoId(null);
    router.push(`/projects/${result.project!.id}`);
  };

  const handleUrlSubmit = async () => {
    await handleImport({ repoUrl });
  };

  const handleRepoImport = async (repo: GitHubRepo) => {
    await handleImport({ repoUrl: repo.html_url, repoId: repo.id });
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
              {isCreatingUrl ? (
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

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setReposError(null);
                setIsLoadingRepos(true);
              }}
              className="pl-9"
            />
          </div>

          {/* Repos List */}
          <div className="rounded-lg border">
            {isLoadingRepos && repos.length === 0 ? (
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
                        <GitHubAvatar
                          username={repo.owner_username}
                          avatarUrl={repo.owner_avatar_url}
                          type={repo.owner_type}
                          size={24}
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
                        {creatingRepoId === repo.id ? (
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
