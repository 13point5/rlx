"use client";

import { useState } from "react";
import { GitHubConnect } from "@/components/github-connect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setStorageItem, STORAGE_KEYS } from "@/lib/storage";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingModal({ open, onOpenChange }: OnboardingModalProps) {
  const [showConnect, setShowConnect] = useState(false);

  const handleSkip = () => {
    // Mark onboarding as skipped/dismissed
    setStorageItem(STORAGE_KEYS.ONBOARDING_DISMISSED, "true");
    onOpenChange(false);
  };

  const handleGetStarted = () => {
    setShowConnect(true);
  };

  const handleDialogChange = (isOpen: boolean) => {
    // If dialog is being closed, mark as dismissed
    if (!isOpen) {
      setStorageItem(STORAGE_KEYS.ONBOARDING_DISMISSED, "true");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to RLX!</DialogTitle>
          <DialogDescription className="text-base">
            {!showConnect ? (
              <>Connect your GitHub account to get started with managing your reinforcement learning experiments.</>
            ) : (
              <>Connect your GitHub account below to import repositories and start tracking experiments.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {!showConnect ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 items-center justify-center rounded-none bg-primary/10 text-primary font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold">Connect GitHub</h3>
                  <p className="text-sm text-muted-foreground">
                    Link your GitHub account to import repositories
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-8 items-center justify-center rounded-none bg-primary/10 text-primary font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold">Create Projects</h3>
                  <p className="text-sm text-muted-foreground">
                    Set up projects to organize your experiments
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-8 items-center justify-center rounded-none bg-primary/10 text-primary font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold">Track Experiments</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor runs, configurations, and results
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={handleSkip}>
                Skip for now
              </Button>
              <Button onClick={handleGetStarted}>
                Get Started
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <GitHubConnect />
            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={handleSkip}>
                Continue to Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
