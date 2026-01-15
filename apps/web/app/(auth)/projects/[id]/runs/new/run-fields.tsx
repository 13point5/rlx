import { LabeledField } from "@/components/labeled-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface RunFieldsProps {
  runName: string;
  branch: string;
  config: string;
  onRunNameChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onConfigChange: (value: string) => void;
  className?: string;
}

export function RunFields({
  runName,
  branch,
  config,
  onRunNameChange,
  onBranchChange,
  onConfigChange,
  className,
}: RunFieldsProps) {
  return (
    <div className={cn("grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} data-slot="run-fields">
      <LabeledField label="Run name" htmlFor="run-name" className="min-w-0">
        <Input
          id="run-name"
          placeholder="e.g. PPO baseline"
          value={runName}
          onChange={(event) => onRunNameChange(event.target.value)}
        />
      </LabeledField>
      <LabeledField label="Repo branch" htmlFor="repo-branch" className="min-w-0">
        <Select value={branch} onValueChange={onBranchChange}>
          <SelectTrigger id="repo-branch" className="w-full">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">main</SelectItem>
            <SelectItem value="feature/dpo">feature/dpo</SelectItem>
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
