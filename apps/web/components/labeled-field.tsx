import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LabeledFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function LabeledField({ label, htmlFor, className, children }: LabeledFieldProps) {
  return (
    <div className={cn("space-y-1", className)} data-slot="labeled-field">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}
