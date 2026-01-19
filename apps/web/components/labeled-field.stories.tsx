import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LabeledField } from "./labeled-field";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const meta: Meta<typeof LabeledField> = {
  title: "Components/LabeledField",
  component: LabeledField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "The label text",
    },
    htmlFor: {
      control: "text",
      description: "ID of the associated form element",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof LabeledField>;

// With input
export const WithInput: Story = {
  render: () => (
    <div className="w-[300px]">
      <LabeledField label="Project Name" htmlFor="project-name">
        <Input id="project-name" placeholder="my-awesome-project" />
      </LabeledField>
    </div>
  ),
};

// With select
export const WithSelect: Story = {
  render: () => (
    <div className="w-[200px]">
      <LabeledField label="GPU Type" htmlFor="gpu-type">
        <Select>
          <SelectTrigger id="gpu-type" className="w-full">
            <SelectValue placeholder="Select GPU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a100">NVIDIA A100</SelectItem>
            <SelectItem value="h100">NVIDIA H100</SelectItem>
          </SelectContent>
        </Select>
      </LabeledField>
    </div>
  ),
};

// Multiple fields
export const MultipleFields: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <LabeledField label="Run Name" htmlFor="run-name">
        <Input id="run-name" placeholder="training-run-1" />
      </LabeledField>
      <div className="grid grid-cols-2 gap-4">
        <LabeledField label="Branch" htmlFor="branch">
          <Select>
            <SelectTrigger id="branch" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="develop">develop</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="GPU Count" htmlFor="gpu-count">
          <Select>
            <SelectTrigger id="gpu-count" className="w-full">
              <SelectValue placeholder="Count" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
      </div>
    </div>
  ),
};

// Form layout
export const FormLayout: Story = {
  render: () => (
    <form className="w-[450px] space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <LabeledField label="Run Name" htmlFor="name" className="min-w-[180px]">
          <Input id="name" placeholder="training-run" />
        </LabeledField>
        <LabeledField label="Branch" htmlFor="branch" className="min-w-[160px]">
          <Select defaultValue="main">
            <SelectTrigger id="branch" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="develop">develop</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Config" htmlFor="config" className="min-w-[200px]">
          <Select>
            <SelectTrigger id="config" className="w-full">
              <SelectValue placeholder="Select config" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="train.yaml">train.yaml</SelectItem>
              <SelectItem value="eval.yaml">eval.yaml</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
      </div>
    </form>
  ),
};

// With custom className
export const CustomWidth: Story = {
  render: () => (
    <LabeledField label="Description" htmlFor="desc" className="w-[400px]">
      <Input id="desc" placeholder="Enter a description..." />
    </LabeledField>
  ),
};
