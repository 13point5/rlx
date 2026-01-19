import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "ghost",
        "link",
      ],
      description: "The visual style variant of the badge",
    },
    asChild: {
      control: "boolean",
      description: "Render as child element using Radix Slot",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// Default badge
export const Default: Story = {
  args: {
    children: "Badge",
    variant: "default",
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge variant="default">
        <Check data-icon="inline-start" />
        Success
      </Badge>
      <Badge variant="destructive">
        <X data-icon="inline-start" />
        Error
      </Badge>
      <Badge variant="secondary">
        <AlertCircle data-icon="inline-start" />
        Warning
      </Badge>
      <Badge variant="outline">
        <Info data-icon="inline-start" />
        Info
      </Badge>
    </div>
  ),
};

// Status badges (common use case)
export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Common status badge patterns:
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
          Active
        </Badge>
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
          Pending
        </Badge>
        <Badge className="bg-red-500/10 text-red-500 border-red-500/30">
          Error
        </Badge>
        <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/30">
          Stopped
        </Badge>
      </div>
    </div>
  ),
};

// Count badges
export const CountBadges: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge variant="default">3</Badge>
      <Badge variant="secondary">12</Badge>
      <Badge variant="outline">99+</Badge>
    </div>
  ),
};

// As link
export const AsLink: Story = {
  render: () => (
    <Badge asChild variant="link">
      <a href="#example">Click me</a>
    </Badge>
  ),
};

// In context
export const InContext: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Project Status:</span>
        <Badge variant="default">Active</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Notifications</span>
        <Badge variant="secondary">5</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Version</span>
        <Badge variant="outline">v2.0.0</Badge>
      </div>
    </div>
  ),
};
