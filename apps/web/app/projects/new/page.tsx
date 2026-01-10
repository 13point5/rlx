"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, ChevronsUpDown, Check, Link as LinkIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GitHubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// TODO: Replace with actual API call
const mockAccounts = [
  { name: "13point5", type: "user" as const },
  { name: "huggingface", type: "org" as const },
];

const mockRepos = [
  {
    name: "rlx",
    owner: "13point5",
    ownerType: "user" as const,
    updatedAt: "3m ago",
  },
  {
    name: "openai-platform-logs-exporter",
    owner: "13point5",
    ownerType: "user" as const,
    updatedAt: "3d ago",
  },
  {
    name: "prime-rl",
    owner: "13point5",
    ownerType: "user" as const,
    updatedAt: "Jan 6",
  },
  {
    name: "blog",
    owner: "13point5",
    ownerType: "user" as const,
    updatedAt: "Jan 4",
  },
  {
    name: "rlm",
    owner: "13point5",
    ownerType: "user" as const,
    updatedAt: "Jan 3",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState(mockAccounts[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const filteredRepos = mockRepos.filter(
    (repo) =>
      repo.owner === selectedAccount.name &&
      repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImport = (repo: (typeof mockRepos)[0]) => {
    // TODO: Actually create the project via API
    router.push(`/projects/1`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8 py-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Start a new RL project
          </h1>

          {/* URL Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter a Git repository URL..."
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              disabled={!repoUrl}
              onClick={() => {
                // TODO: Handle URL import
                router.push(`/projects/1`);
              }}
            >
              Continue
            </Button>
          </div>
        </div>

        {/* Import Git Repository */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Import Git Repository</h2>

          <div className="flex gap-2">
            {/* Account Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-48 justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <GitHubIcon className="size-4" />
                    <span>{selectedAccount.name}</span>
                  </div>
                  <ChevronsUpDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {mockAccounts.map((account) => (
                  <DropdownMenuItem
                    key={account.name}
                    onClick={() => setSelectedAccount(account)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <GitHubIcon className="size-4" />
                      <span>{account.name}</span>
                    </div>
                    {selectedAccount.name === account.name && (
                      <Check className="size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Repos List */}
          <div className="rounded-lg border">
            {filteredRepos.length > 0 ? (
              <ul className="divide-y">
                {filteredRepos.map((repo) => (
                  <li
                    key={repo.name}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={`https://github.com/${repo.owner}.png`}
                        alt={repo.owner}
                        width={24}
                        height={24}
                        className={
                          repo.ownerType === "user"
                            ? "rounded-full"
                            : "rounded-sm"
                        }
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{repo.name}</span>
                        <span className="text-sm text-muted-foreground">
                          · {repo.updatedAt}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleImport(repo)}>
                      Import
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No repositories found
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
