"use client";

import { useState, useEffect } from "react";
import { OnboardingModal } from "@/components/onboarding-modal";
import { getGitHubStatus } from "@/app/actions/api";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage";

interface OnboardingWrapperProps {
  children: React.ReactNode;
  hasProjects: boolean;
}

export function OnboardingWrapper({ children, hasProjects }: OnboardingWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Check if user has already dismissed onboarding
      const hasSeenOnboarding = getStorageItem(STORAGE_KEYS.ONBOARDING_DISMISSED);

      if (hasSeenOnboarding) {
        setIsChecking(false);
        return;
      }

      // If user has projects, don't show onboarding
      if (hasProjects) {
        setStorageItem(STORAGE_KEYS.ONBOARDING_DISMISSED, "true");
        setIsChecking(false);
        return;
      }

      // Check if user has GitHub connected
      const status = await getGitHubStatus();

      if (status.connected) {
        // User has GitHub connected, don't show onboarding
        setStorageItem(STORAGE_KEYS.ONBOARDING_DISMISSED, "true");
        setIsChecking(false);
      } else {
        // First-time user without GitHub connection - show onboarding
        setShowOnboarding(true);
        setIsChecking(false);
      }
    };

    checkOnboardingStatus();
  }, [hasProjects]);

  const handleOnboardingClose = (open: boolean) => {
    if (!open) {
      // User closed or completed onboarding (localStorage is set in modal)
      setShowOnboarding(false);
    }
  };

  if (isChecking) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <OnboardingModal open={showOnboarding} onOpenChange={handleOnboardingClose} />
    </>
  );
}
