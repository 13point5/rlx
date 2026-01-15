import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeadingProps {
  children: ReactNode;
  className?: string;
}

export function PageHeading({ children, className }: PageHeadingProps) {
  return (
    <h1 className={cn("text-2xl md:text-3xl font-bold", className)} data-slot="page-heading">
      {children}
    </h1>
  );
}
