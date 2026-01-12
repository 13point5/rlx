"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useBreadcrumbs } from "@/components/breadcrumb-context";

export function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  const { breadcrumbs, isLoading, setIsLoading } = useBreadcrumbs();
  const pathname = usePathname();

  // TODO: Fix breadcrumb loading skeleton behavior during navigation
  // Current implementation doesn't properly handle all edge cases
  // - Loading state should show during route transitions
  // - Should clear when new page data is loaded
  // - Needs proper synchronization without setTimeout hacks
  useEffect(() => {
    // Start loading when route changes
    setIsLoading(true);
  }, [pathname, setIsLoading]);

  useEffect(() => {
    // Clear loading when breadcrumbs are set (or cleared)
    if (breadcrumbs.length > 0 || pathname === "/home" || pathname === "/settings") {
      setIsLoading(false);
    }
  }, [breadcrumbs, pathname, setIsLoading]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} isLoading={isLoading} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
