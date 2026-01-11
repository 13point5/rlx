import { DeleteProject } from "@/components/delete-project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  projectId: number;
  projectName: string;
}

export const SettingsTab = ({ projectId, projectName }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="rounded-lg border border-destructive/50">
            <div className="space-y-2 p-4">
              <h3 className="text-lg font-semibold">Delete Project</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project and all deployments, domains,
                environment variables, serverless functions, and settings.
              </p>
            </div>
            <div className="flex flex-col gap-4 border-t border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">
                This action cannot be undone.
              </p>
              <DeleteProject projectId={projectId} projectName={projectName} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
