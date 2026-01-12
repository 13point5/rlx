import { GitHubSettings } from "@/components/github-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and integrations
        </p>
      </div>

      <div className="border-t pt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">GitHub Integration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your GitHub account to import repositories and track experiments
            </p>
          </div>

          <GitHubSettings />
        </div>
      </div>
    </div>
  );
}
