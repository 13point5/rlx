import { AppHeader } from "@/components/app-header";
import type { BreadcrumbItem } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function AppShell({ children, breadcrumbs }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
