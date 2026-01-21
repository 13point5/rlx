import { ExternalLink, Loader2 } from "lucide-react";
import { LabeledField } from "@/components/labeled-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { RlxConfigEntry } from "@/lib/types";

export interface BranchesState {
  branches: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

export interface ConfigsState {
  configs: RlxConfigEntry[];
  found: boolean;
  isLoading: boolean;
  error: string | null;
}

interface RunFieldsProps {
  runName: string;
  branch: string;
  selectedConfig: RlxConfigEntry | null;
  branchesState: BranchesState;
  configsState: ConfigsState;
  repoOwner: string;
  repoName: string;
  onRunNameChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onConfigChange: (config: RlxConfigEntry | null) => void;
  onLoadMoreBranches: () => void;
  className?: string;
}

export function RunFields({
  runName,
  branch,
  selectedConfig,
  branchesState,
  configsState,
  repoOwner,
  repoName,
  onRunNameChange,
  onBranchChange,
  onConfigChange,
  onLoadMoreBranches,
  className,
}: RunFieldsProps) {
  const { branches, isLoading, isLoadingMore, hasMore, error } = branchesState;
  const { configs, found: configsFound, isLoading: configsLoading, error: configsError } = configsState;

  // Build GitHub URL for the selected config's rlx.toml
  const cleanBranch = branch.startsWith("origin/") ? branch.slice(7) : branch;
  const rlxTomlUrl = `https://github.com/${repoOwner}/${repoName}/blob/${cleanBranch}/rlx.toml`;

  return (
    <div
      className={cn(
        "grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
      data-slot="run-fields"
    >
      <LabeledField label="Run name" htmlFor="run-name" className="min-w-0">
        <Input
          id="run-name"
          placeholder="e.g. PPO baseline"
          value={runName}
          onChange={(event) => onRunNameChange(event.target.value)}
        />
      </LabeledField>
      <LabeledField label="Repo branch" htmlFor="repo-branch" className="min-w-0">
        <Select value={branch} onValueChange={onBranchChange} disabled={isLoading}>
          <SelectTrigger id="repo-branch" className="w-full">
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading...
              </span>
            ) : (
              <SelectValue placeholder="Select branch" />
            )}
          </SelectTrigger>
          <SelectContent>
            {error ? (
              <div className="px-2 py-2 text-xs text-destructive">{error}</div>
            ) : branches.length === 0 && !isLoading ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No branches found
              </div>
            ) : (
              <>
                {branches.map((branchName) => (
                  <SelectItem key={branchName} value={`origin/${branchName}`}>
                    origin/{branchName}
                  </SelectItem>
                ))}
                {hasMore && (
                  <div className="border-t px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onLoadMoreBranches();
                      }}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </SelectContent>
        </Select>
      </LabeledField>
      <LabeledField
        label={
          <span className="flex items-center gap-1.5">
            Config
            {configsFound && (
              <a
                href={rlxTomlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="Open rlx.toml on GitHub"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </span>
        }
        htmlFor="run-config"
        className="min-w-0"
      >
        <Select
          value={selectedConfig?.name ?? ""}
          onValueChange={(name) => {
            const config = configs.find((c) => c.name === name) ?? null;
            onConfigChange(config);
          }}
          disabled={configsLoading || !configsFound}
        >
          <SelectTrigger id="run-config" className="w-full">
            {configsLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Loading...
              </span>
            ) : !configsFound ? (
              <span className="text-muted-foreground">No rlx.toml</span>
            ) : (
              <SelectValue placeholder="Select config">
                {selectedConfig?.name}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {configsError ? (
              <div className="px-2 py-2 text-xs text-destructive">{configsError}</div>
            ) : !configsFound ? (
              <div className="space-y-2 px-3 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">No rlx.toml found</p>
                <p>Create an rlx.toml file in your repository root:</p>
                <pre className="mt-2 rounded bg-muted p-2 text-[10px]">
{`[sft-baseline]
description = "SFT training"
config = "configs/sft.toml"

[rl-grpo]
description = "GRPO RL"
config = "configs/rl.toml"`}
                </pre>
              </div>
            ) : configs.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No configs defined in rlx.toml
              </div>
            ) : (
              configs.map((configEntry) => (
                <SelectItem key={configEntry.name} value={configEntry.name}>
                  <div className="flex flex-col">
                    <span>{configEntry.name}</span>
                    {configEntry.description && (
                      <span className="text-xs text-muted-foreground">
                        {configEntry.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </LabeledField>
    </div>
  );
}
