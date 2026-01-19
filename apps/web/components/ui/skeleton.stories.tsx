import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";
import { Card, CardHeader, CardContent } from "./card";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// Default skeleton
export const Default: Story = {
  render: () => <Skeleton className="h-4 w-[250px]" />,
};

// Different sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <Skeleton className="h-3 w-[100px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-5 w-[300px]" />
      <Skeleton className="h-6 w-[250px]" />
      <Skeleton className="h-8 w-[180px]" />
    </div>
  ),
};

// Different shapes
export const Shapes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton className="size-10 rounded-full" />
      <Skeleton className="size-10 rounded-none" />
      <Skeleton className="h-10 w-24 rounded-none" />
      <Skeleton className="h-10 w-24 rounded-md" />
    </div>
  ),
};

// Text placeholder
export const TextPlaceholder: Story = {
  render: () => (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  ),
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Avatar placeholder
export const AvatarPlaceholder: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-3 w-[100px]" />
      </div>
    </div>
  ),
};

// Card skeleton
export const CardSkeleton: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-none" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-24 rounded-none" />
        </div>
      </CardContent>
    </Card>
  ),
};

// Table row skeleton
export const TableRowSkeleton: Story = {
  render: () => (
    <div className="w-[600px] border border-border rounded-none">
      <div className="p-4">
        {/* Table header */}
        <div className="flex gap-8 pb-3 border-b border-border">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 py-4 border-b border-border last:border-0">
            <div className="w-40 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-3" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-20 rounded-none" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  ),
};

// Form skeleton
export const FormSkeleton: Story = {
  render: () => (
    <div className="w-[350px] space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  ),
};

// Project card skeleton (matching actual component)
export const ProjectCardSkeleton: Story = {
  render: () => (
    <Card className="w-[350px] flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-none" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="size-4" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-24 rounded-none" />
      </div>
    </Card>
  ),
};

// Grid of skeletons
export const GridSkeleton: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-none" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="size-4" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-20 rounded-none" />
          </div>
        </Card>
      ))}
    </div>
  ),
};
