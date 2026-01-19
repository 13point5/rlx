import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "The title of the empty state",
    },
    description: {
      control: "text",
      description: "Description text explaining the empty state",
    },
    actionLabel: {
      control: "text",
      description: "Label for the action button",
    },
    actionHref: {
      control: "text",
      description: "URL for the action button",
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

// Default empty state with action
export const Default: Story = {
  args: {
    title: "No projects yet",
    description:
      "Create your first project by connecting a GitHub repository with your RL training configs.",
    actionLabel: "Create Project",
    actionHref: "/projects/new",
  },
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

// Empty state without action
export const WithoutAction: Story = {
  args: {
    title: "No runs found",
    description:
      "This project doesn't have any training runs yet. Create a new run to get started.",
  },
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

// Empty search results
export const SearchResults: Story = {
  args: {
    title: "No results found",
    description: 'No projects match your search query "machine learning".',
  },
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

// Empty configs
export const NoConfigs: Story = {
  args: {
    title: "No config files",
    description:
      "No configuration files found in this repository. Add a config file to start training.",
    actionLabel: "Learn More",
    actionHref: "/docs/configs",
  },
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

// SSH keys empty state
export const NoSSHKeys: Story = {
  args: {
    title: "No SSH keys",
    description:
      "Add an SSH key to securely connect to your training instances.",
    actionLabel: "Add SSH Key",
    actionHref: "/settings",
  },
  decorators: [
    (Story) => (
      <div className="w-[500px]">
        <Story />
      </div>
    ),
  ],
};

// In context - full width
export const FullWidth: Story = {
  args: {
    title: "No projects yet",
    description:
      "Create your first project by connecting a GitHub repository.",
    actionLabel: "Create Project",
    actionHref: "/projects/new",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
};
