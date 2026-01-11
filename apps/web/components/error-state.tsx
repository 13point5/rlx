"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  retry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  retry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="size-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && (
        <p className="text-muted-foreground mt-1 max-w-md">{message}</p>
      )}
      {retry && (
        <Button onClick={retry} variant="outline" className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}
