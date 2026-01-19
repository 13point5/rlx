import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
      description: "The visual style variant of the button",
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
      description: "The size of the button",
    },
    disabled: {
      control: "boolean",
      description: "Whether the button is disabled",
    },
    asChild: {
      control: "boolean",
      description: "Render as child element using Radix Slot",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Default button
export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

// Icon button sizes
export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="icon-xs" variant="outline">
        <Plus />
      </Button>
      <Button size="icon-sm" variant="outline">
        <Plus />
      </Button>
      <Button size="icon" variant="outline">
        <Plus />
      </Button>
      <Button size="icon-lg" variant="outline">
        <Plus />
      </Button>
    </div>
  ),
};

// With icons
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button>
          <Plus data-icon="inline-start" />
          Add New
        </Button>
        <Button variant="outline">
          Continue
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm">
          <Plus data-icon="inline-start" />
          Small Button
        </Button>
        <Button size="lg">
          <Plus data-icon="inline-start" />
          Large Button
        </Button>
      </div>
    </div>
  ),
};

// Loading state
export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>
        <Loader2 className="animate-spin" data-icon="inline-start" />
        Loading...
      </Button>
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin" data-icon="inline-start" />
        Please wait
      </Button>
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>Disabled Default</Button>
      <Button variant="outline" disabled>
        Disabled Outline
      </Button>
      <Button variant="destructive" disabled>
        Disabled Destructive
      </Button>
    </div>
  ),
};

// Destructive actions
export const DestructiveActions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="destructive">Delete</Button>
      <Button variant="destructive" size="sm">
        Remove
      </Button>
    </div>
  ),
};

// As Link (using asChild with anchor)
export const AsLink: Story = {
  render: () => (
    <Button asChild>
      <a href="#example">Navigate Here</a>
    </Button>
  ),
};

// Outline variants by context
export const OutlineVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Outline buttons with different states:
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline">Default</Button>
        <Button variant="outline" aria-expanded="true">
          Expanded (aria-expanded)
        </Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
      </div>
    </div>
  ),
};
