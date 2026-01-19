import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageHeading } from "./page-heading";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

const meta: Meta<typeof PageHeading> = {
  title: "Components/PageHeading",
  component: PageHeading,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    children: {
      control: "text",
      description: "The heading text",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeading>;

// Default heading
export const Default: Story = {
  args: {
    children: "Projects",
  },
};

// Different page titles
export const AllPages: Story = {
  render: () => (
    <div className="space-y-6">
      <PageHeading>Projects</PageHeading>
      <PageHeading>Runs</PageHeading>
      <PageHeading>Settings</PageHeading>
      <PageHeading>New Run</PageHeading>
    </div>
  ),
};

// With custom className
export const CustomStyle: Story = {
  args: {
    children: "Custom Heading",
    className: "text-primary",
  },
};

// In page context
export const InPageContext: Story = {
  render: () => (
    <div className="w-[600px] space-y-6">
      <PageHeading>Projects</PageHeading>
      <div className="flex items-center gap-3">
        <div className="h-8 flex-1 bg-accent/50 rounded-none border" />
        <Button>
          <Plus className="size-4" />
          Add New
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 border border-border rounded-none bg-card"
          />
        ))}
      </div>
    </div>
  ),
};

// Project page layout
export const ProjectPageLayout: Story = {
  render: () => (
    <div className="w-[600px] space-y-4">
      <PageHeading>Runs</PageHeading>
      <div className="flex items-center gap-4">
        <div className="h-9 w-48 bg-card border border-border rounded-none" />
        <Button>
          <Plus className="size-4" />
          New Run
        </Button>
      </div>
      <div className="border border-border rounded-none">
        <div className="h-64 bg-card" />
      </div>
    </div>
  ),
};
