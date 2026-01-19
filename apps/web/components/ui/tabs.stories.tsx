import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Settings, Play, FileCode } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Card, CardHeader, CardTitle, CardContent } from "./card";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

// Default tabs
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="runs" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="configs">Configs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="runs" className="p-4">
        <p className="text-muted-foreground">Runs content goes here.</p>
      </TabsContent>
      <TabsContent value="configs" className="p-4">
        <p className="text-muted-foreground">Configs content goes here.</p>
      </TabsContent>
      <TabsContent value="settings" className="p-4">
        <p className="text-muted-foreground">Settings content goes here.</p>
      </TabsContent>
    </Tabs>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <Tabs defaultValue="runs" className="w-[450px]">
      <TabsList>
        <TabsTrigger value="runs">
          <Play className="size-3.5" />
          Runs
        </TabsTrigger>
        <TabsTrigger value="configs">
          <FileCode className="size-3.5" />
          Configs
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="size-3.5" />
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="runs" className="p-4">
        <p className="text-muted-foreground">View and manage your runs.</p>
      </TabsContent>
      <TabsContent value="configs" className="p-4">
        <p className="text-muted-foreground">View your config files.</p>
      </TabsContent>
      <TabsContent value="settings" className="p-4">
        <p className="text-muted-foreground">Project settings.</p>
      </TabsContent>
    </Tabs>
  ),
};

// Two tabs
export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[300px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="p-4">
        <p className="text-muted-foreground">Overview content.</p>
      </TabsContent>
      <TabsContent value="details" className="p-4">
        <p className="text-muted-foreground">Details content.</p>
      </TabsContent>
    </Tabs>
  ),
};

// Tabs with card content
export const WithCardContent: Story = {
  render: () => (
    <Tabs defaultValue="runs" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        <TabsTrigger value="configs">Configs</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="runs">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Training Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your training runs will appear here.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="configs">
        <Card size="sm">
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
        <Card size="sm">
          <CardHeader>
            <CardTitle>Project Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Manage your project settings here.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

// Disabled tab
export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="another">Another</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="p-4">
        <p className="text-muted-foreground">Active tab content.</p>
      </TabsContent>
      <TabsContent value="another" className="p-4">
        <p className="text-muted-foreground">Another tab content.</p>
      </TabsContent>
    </Tabs>
  ),
};

// Project page tabs layout
export const ProjectPageLayout: Story = {
  render: () => (
    <div className="w-[600px] space-y-4">
      <div className="flex items-center gap-4">
        <Tabs defaultValue="runs" className="flex-1">
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="configs">Configs</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="runs" className="mt-4">
            <div className="border border-border rounded-none p-4">
              <p className="text-muted-foreground">Runs table content...</p>
            </div>
          </TabsContent>
          <TabsContent value="configs" className="mt-4">
            <Card size="sm">
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
          <TabsContent value="settings" className="mt-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Project settings here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  ),
};
