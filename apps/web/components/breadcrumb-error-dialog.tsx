"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home, RotateCcw } from "lucide-react";

interface BreadcrumbErrorDialogProps {
  error: string;
  onRefresh: () => void;
  onGoHome: () => void;
}

export function BreadcrumbErrorDialog({
  error,
  onRefresh,
  onGoHome,
}: BreadcrumbErrorDialogProps) {
  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Breadcrumb Error</DialogTitle>
          <DialogDescription>
            There was an error generating the navigation breadcrumbs.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-3">
            <Button onClick={onRefresh} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
            <Button onClick={onGoHome} variant="outline" className="flex-1">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
