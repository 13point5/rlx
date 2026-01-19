import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Label } from "./label";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

// Default select
export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
        <SelectItem value="option2">Option 2</SelectItem>
        <SelectItem value="option3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
};

// With label
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <Label>GPU Type</Label>
      <Select defaultValue="a100">
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select GPU" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a100">NVIDIA A100</SelectItem>
          <SelectItem value="h100">NVIDIA H100</SelectItem>
          <SelectItem value="rtx4090">NVIDIA RTX 4090</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// Small size
export const SmallSize: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Select>
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue placeholder="Small" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger size="default" className="w-[150px]">
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// With groups
export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Select GPU" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>High Performance</SelectLabel>
          <SelectItem value="h100">NVIDIA H100</SelectItem>
          <SelectItem value="a100">NVIDIA A100</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Consumer</SelectLabel>
          <SelectItem value="rtx4090">NVIDIA RTX 4090</SelectItem>
          <SelectItem value="rtx4080">NVIDIA RTX 4080</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

// Branch selection (common use case)
export const BranchSelection: Story = {
  render: () => (
    <div className="space-y-2">
      <Label>Branch</Label>
      <Select defaultValue="main">
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">main</SelectItem>
          <SelectItem value="develop">develop</SelectItem>
          <SelectItem value="feature/new-model">feature/new-model</SelectItem>
          <SelectItem value="hotfix/bug-fix">hotfix/bug-fix</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// GPU count selection
export const GpuCountSelection: Story = {
  render: () => (
    <div className="space-y-2">
      <Label>GPU Count</Label>
      <Select defaultValue="1">
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Count" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1</SelectItem>
          <SelectItem value="2">2</SelectItem>
          <SelectItem value="4">4</SelectItem>
          <SelectItem value="8">8</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

// Disabled select
export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Disabled" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option1">Option 1</SelectItem>
      </SelectContent>
    </Select>
  ),
};

// With disabled items
export const WithDisabledItems: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select GPU" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="h100">NVIDIA H100</SelectItem>
        <SelectItem value="a100">NVIDIA A100</SelectItem>
        <SelectItem value="rtx4090" disabled>
          RTX 4090 (unavailable)
        </SelectItem>
        <SelectItem value="rtx3090" disabled>
          RTX 3090 (unavailable)
        </SelectItem>
      </SelectContent>
    </Select>
  ),
};

// Form example
export const FormExample: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>GPU Type</Label>
          <Select defaultValue="a100">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select GPU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a100">NVIDIA A100</SelectItem>
              <SelectItem value="h100">NVIDIA H100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Count</Label>
          <Select defaultValue="4">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Count" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="8">8</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Branch</Label>
        <Select defaultValue="main">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">main</SelectItem>
            <SelectItem value="develop">develop</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
};
