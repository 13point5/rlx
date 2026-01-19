import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search, Mail, Lock, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "url", "tel"],
      description: "The type of input",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text",
    },
    disabled: {
      control: "boolean",
      description: "Whether the input is disabled",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// Default input
export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
  decorators: [
    (Story) => (
      <div className="w-[300px]">
        <Story />
      </div>
    ),
  ],
};

// With label
export const WithLabel: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="Enter your email" />
    </div>
  ),
};

// Input types
export const InputTypes: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text">Text</Label>
        <Input id="text" type="text" placeholder="Enter text..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="email@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="Enter password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="number">Number</Label>
        <Input id="number" type="number" placeholder="0" />
      </div>
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <div className="space-y-2">
        <Label>Default</Label>
        <Input placeholder="Default input" />
      </div>
      <div className="space-y-2">
        <Label>Disabled</Label>
        <Input placeholder="Disabled input" disabled />
      </div>
      <div className="space-y-2">
        <Label>Invalid</Label>
        <Input placeholder="Invalid input" aria-invalid="true" />
      </div>
      <div className="space-y-2">
        <Label>With value</Label>
        <Input defaultValue="Some value here" />
      </div>
    </div>
  ),
};

// With icons (using wrapper)
export const WithIcons: Story = {
  render: () => (
    <div className="w-[300px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="search" placeholder="Search..." className="pl-9" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-icon">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email-icon"
            type="email"
            placeholder="email@example.com"
            className="pl-9"
          />
        </div>
      </div>
    </div>
  ),
};

// Password input with toggle
function PasswordInputWithToggle() {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="password-toggle">Password</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="password-toggle"
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
          className="pl-9 pr-9"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export const PasswordWithToggle: Story = {
  render: () => <PasswordInputWithToggle />,
};

// File input
export const FileInput: Story = {
  render: () => (
    <div className="w-[300px] space-y-2">
      <Label htmlFor="file">Upload file</Label>
      <Input id="file" type="file" />
    </div>
  ),
};

// Form example
export const FormExample: Story = {
  render: () => (
    <form className="w-[350px] space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input id="name" placeholder="my-awesome-project" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" placeholder="A brief description..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <Input id="branch" placeholder="main" defaultValue="main" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gpu-count">GPU Count</Label>
          <Input id="gpu-count" type="number" placeholder="1" defaultValue="1" />
        </div>
      </div>
    </form>
  ),
};
