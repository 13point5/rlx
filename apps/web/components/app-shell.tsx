import { AppHeader } from "@/components/app-header";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export function AppShell({ children, breadcrumbs }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
