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
  className?: string;
}

export function RunFields({ className }: RunFieldsProps) {
  return (
    <div className={cn("grid w-full gap-4 sm:grid-cols-3", className)} data-slot="run-fields">
      <LabeledField label="Run name" htmlFor="run-name" className="min-w-[180px]">
        <Input id="run-name" placeholder="e.g. PPO baseline" />
      </LabeledField>
      <LabeledField label="Repo branch" htmlFor="repo-branch" className="min-w-[160px]">
        <Select defaultValue="main">
          <SelectTrigger id="repo-branch" className="w-full">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">main</SelectItem>
            <SelectItem value="feature/dpo">feature/dpo</SelectItem>
          </SelectContent>
        </Select>
      </LabeledField>
      <LabeledField label="Config" htmlFor="run-config" className="min-w-[200px]">
        <Select defaultValue="configs/ppo.yaml">
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
