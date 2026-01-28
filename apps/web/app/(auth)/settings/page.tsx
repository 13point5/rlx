import { GitHubSettings } from "@/components/github-settings";
import { SSHKeySettings } from "@/components/ssh-key-settings";
import { WandbSettings } from "@/components/wandb-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Manage your account settings and integrations
        </p>
      </div>

      <div className="border-t pt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">GitHub Integration</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your GitHub account to import repositories and track experiments
            </p>
          </div>

          <GitHubSettings />
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">SSH Keys</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure SSH keys for GPU pod access
            </p>
          </div>

          <SSHKeySettings />
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Weights & Biases</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add your W&B API key for experiment tracking
            </p>
          </div>

          <WandbSettings />
        </div>
      </div>
    </div>
  );
}
