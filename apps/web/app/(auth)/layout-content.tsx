"use client";

import { AppHeader } from "@/components/app-header";
import { useBreadcrumbs } from "@/components/breadcrumb-context";

export function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  const { breadcrumbs } = useBreadcrumbs();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
