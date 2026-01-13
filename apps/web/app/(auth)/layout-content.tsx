"use client";

import { AppHeader } from "@/components/app-header";

export function AuthLayoutContent({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
