import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, GitBranch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// TODO: Replace with actual API call
// A project = GitHub repo
const mockProjects = [
  {
    id: "1",
    name: "openrlhf-experiments",
    owner: "13point5",
    ownerType: "user" as const,
  },
  {
    id: "2",
    name: "ppo-training",
    owner: "13point5",
    ownerType: "user" as const,
  },
  {
    id: "3",
    name: "trl",
    owner: "huggingface",
    ownerType: "org" as const,
  },
  {
    id: "4",
    name: "grpo-experiments",
    owner: "huggingface",
    ownerType: "org" as const,
  },
];

const mockRuns = [
  {
    id: "run-1",
    name: "Training Run #1",
    branch: "main",
    config: "configs/ppo.yaml",
    status: "completed",
    createdAt: "2 hours ago",
    gpu: "H100",
  },
  {
    id: "run-2",
    name: "Training Run #2",
    branch: "feature/dpo",
    config: "configs/dpo.yaml",
    status: "running",
    createdAt: "30 min ago",
    gpu: "A100",
  },
  {
    id: "run-3",
    name: "Training Run #3",
    branch: "main",
    config: "configs/ppo.yaml",
    status: "failed",
    createdAt: "1 day ago",
    gpu: "H100",
  },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const user = await currentUser();
  const { id } = await params;

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: Fetch actual project
  const project = mockProjects.find((p) => p.id === id) ?? mockProjects[0];
  const repoFullName = `${project.owner}/${project.name}`;

  const breadcrumbs = [
    {
      label: project.name,
      items: mockProjects.map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
        active: p.id === id,
      })),
    },
  ];

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Project Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={`https://github.com/${repoFullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80"
          >
            <Image
              src={`https://github.com/${project.owner}.png`}
              alt={project.owner}
              width={24}
              height={24}
              className={
                project.ownerType === "user" ? "rounded-full" : "rounded-sm"
              }
            />
            <h1 className="text-xl tracking-tight">
              <span className="text-muted-foreground">{project.owner}</span>
              <span className="text-muted-foreground/50 mx-1">/</span>
              <span className="font-bold">{project.name}</span>
            </h1>
          </a>
          <Button asChild>
            <Link href={`/projects/${id}/new-run`}>
              <Plus className="size-4" />
              New Run
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="runs">Runs</TabsTrigger>
            <TabsTrigger value="configs">Configs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="space-y-4">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>GPU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRuns.map((run) => (
                    <TableRow key={run.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/projects/${id}/runs/${run.id}`}>
                          <div className="font-medium hover:underline">
                            {run.name}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {run.config}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <GitBranch className="size-3" />
                          <span className="max-w-[120px] truncate">
                            {run.branch}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.gpu}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.createdAt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="configs">
            <Card>
              <CardHeader>
                <CardTitle>Config Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Config files from your repository will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Project settings will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    running: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-green-500/10 text-green-500 border-green-500/20",
    failed: "bg-red-500/10 text-red-500 border-red-500/20",
    pending: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        colors[status as keyof typeof colors] ?? colors.pending
      }`}
    >
      {status}
    </span>
  );
}
