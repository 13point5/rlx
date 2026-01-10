import { AppHeader } from "@/components/app-header";

interface BreadcrumbItem {
  label: string;
  href?: string;
  items?: { label: string; href: string; active?: boolean }[];
}

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
