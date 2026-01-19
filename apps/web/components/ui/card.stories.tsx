import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "The size of the card",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// Default card
export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>
          This is a description of what this card contains.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here. You can put any content inside a card.</p>
      </CardContent>
    </Card>
  ),
};

// Small size card
export const SmallSize: Story = {
  render: () => (
    <Card className="w-[350px]" size="sm">
      <CardHeader>
        <CardTitle>Small Card</CardTitle>
        <CardDescription>A more compact card variant.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Content with reduced padding.</p>
      </CardContent>
    </Card>
  ),
};

// With footer
export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Project Settings</CardTitle>
        <CardDescription>Manage your project configuration.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Make changes to your project settings here.</p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

// With action button
export const WithAction: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Training Run</CardTitle>
        <CardDescription>Run #1234 - Started 2 hours ago</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Status:</span>
            <span className="ml-1 text-green-500">Active</span>
          </div>
          <div>
            <span className="text-muted-foreground">GPU:</span>
            <span className="ml-1">A100 x4</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

// Interactive card (hover state)
export const Interactive: Story = {
  render: () => (
    <Card className="w-[350px] cursor-pointer transition-colors hover:border-accent/50 hover:bg-accent/20">
      <CardHeader>
        <CardTitle>Clickable Card</CardTitle>
        <CardDescription>Hover to see the interactive state.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card has hover styles for interactive elements.</p>
      </CardContent>
    </Card>
  ),
};

// Multiple cards layout
export const MultipleCards: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Project Alpha</CardTitle>
          <CardDescription>owner/alpha</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center rounded-none border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
            1 active run
          </span>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Project Beta</CardTitle>
          <CardDescription>owner/beta</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center rounded-none border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            No active runs
          </span>
        </CardContent>
      </Card>
    </div>
  ),
};

// Card with header border
export const WithHeaderBorder: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader className="border-b">
        <CardTitle>Bordered Header</CardTitle>
        <CardDescription>Header has a bottom border.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p>Content separated by a border.</p>
      </CardContent>
    </Card>
  ),
};

// Destructive action card
export const DestructiveAction: Story = {
  render: () => (
    <Card className="w-[350px] border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          This action cannot be undone. This will permanently delete your
          project.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="destructive">
          <Trash2 />
          Delete Project
        </Button>
      </CardFooter>
    </Card>
  ),
};
