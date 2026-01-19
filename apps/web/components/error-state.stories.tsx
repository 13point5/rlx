import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorState } from "./error-state";

const meta: Meta<typeof ErrorState> = {
  title: "Components/ErrorState",
  component: ErrorState,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
      description: "The title of the error",
    },
    message: {
      control: "text",
      description: "Description of the error",
    },
    retry: {
      description: "Callback function for retry button",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

// Default error state
export const Default: Story = {
  args: {
    title: "Something went wrong",
  },
};

// With message
export const WithMessage: Story = {
  args: {
    title: "Failed to load projects",
    message: "Unable to connect to the server. Please check your internet connection and try again.",
  },
};

// With retry button
export const WithRetry: Story = {
  args: {
    title: "Failed to load data",
    message: "An error occurred while fetching the data.",
    retry: () => console.log("Retry clicked"),
  },
};

// Network error
export const NetworkError: Story = {
  args: {
    title: "Network Error",
    message: "Unable to reach the server. Please check your connection.",
    retry: () => console.log("Retry clicked"),
  },
};

// Not found error
export const NotFound: Story = {
  args: {
    title: "Project not found",
    message: "The project you're looking for doesn't exist or has been deleted.",
  },
};

// Permission error
export const PermissionError: Story = {
  args: {
    title: "Access denied",
    message: "You don't have permission to view this resource.",
  },
};

// API error
export const APIError: Story = {
  args: {
    title: "API Error",
    message: "The server returned an unexpected response. Error code: 500.",
    retry: () => console.log("Retry clicked"),
  },
};

// In context - with width
export const InContext: Story = {
  args: {
    title: "Failed to load runs",
    message: "Unable to load training runs for this project.",
    retry: () => console.log("Retry clicked"),
  },
  decorators: [
    (Story) => (
      <div className="w-[600px] border border-border rounded-none p-8">
        <Story />
      </div>
    ),
  ],
};
