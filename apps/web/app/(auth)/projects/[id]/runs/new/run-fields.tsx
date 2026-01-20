import { Loader2 } from "lucide-react";
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

interface BranchesState {
  branches: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

interface RunFieldsProps {
  runName: string;
  branch: string;
  config: string;
  branchesState: BranchesState;
  onRunNameChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onConfigChange: (value: string) => void;
  onLoadMoreBranches: () => void;
  className?: string;
}

export function RunFields({
  runName,
  branch,
  config,
  branchesState,
  onRunNameChange,
  onBranchChange,
  onConfigChange,
  onLoadMoreBranches,
  className,
}: RunFieldsProps) {
  const { branches, isLoading, isLoadingMore, hasMore, error } = branchesState;

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
      <LabeledField label="Config" htmlFor="run-config" className="min-w-0">
        <Select value={config} onValueChange={onConfigChange}>
          <SelectTrigger id="run-config" className="w-full">
            <SelectValue placeholder="Select config" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="configs/ppo.yaml">configs/ppo.yaml</SelectItem>
            <SelectItem value="configs/dpo.yaml">configs/dpo.yaml</SelectItem>
          </SelectContent>
        </Select>
      </LabeledField>
    </div>
  );
}
