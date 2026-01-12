import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GitHubConnect } from "@/components/github-connect";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
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

            <GitHubConnect />
          </div>
        </div>
      </div>
    </div>
  );
}
