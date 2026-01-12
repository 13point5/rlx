"use client";

import { useState, useEffect } from "react";
import { OnboardingModal } from "@/components/onboarding-modal";
import { getGitHubStatus } from "@/app/actions/api";

interface OnboardingWrapperProps {
  children: React.ReactNode;
  hasProjects: boolean;
}

export function OnboardingWrapper({ children, hasProjects }: OnboardingWrapperProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Check if user has already completed onboarding
      const hasCompletedOnboarding = localStorage.getItem("onboarding_completed");

      if (hasCompletedOnboarding) {
        setIsChecking(false);
        return;
      }

      // If user has projects, consider onboarding complete
      if (hasProjects) {
        localStorage.setItem("onboarding_completed", "true");
        setIsChecking(false);
        return;
      }

      // Check if user has GitHub connected
      const status = await getGitHubStatus();

      if (status.connected) {
        // User has GitHub connected, mark onboarding as complete
        localStorage.setItem("onboarding_completed", "true");
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
      // User closed or completed onboarding
      localStorage.setItem("onboarding_completed", "true");
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
