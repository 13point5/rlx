import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectCard, ProjectCardSkeleton } from "./project-card";
import type { Project } from "@/lib/types";

const meta: Meta<typeof ProjectCard> = {
  title: "Components/ProjectCard",
  component: ProjectCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

// Sample project data
const sampleProject: Project = {
  id: 1,
  repo_id: 12345,
  repo_name: "my-ml-project",
  repo_owner: "octocat",
  repo_owner_type: "User",
  active_runs: 2,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
};

const orgProject: Project = {
  id: 2,
  repo_id: 67890,
  repo_name: "organization-ml-repo",
  repo_owner: "tensorflow",
  repo_owner_type: "Organization",
  active_runs: 0,
  created_at: "2024-01-14T10:00:00Z",
  updated_at: "2024-01-14T10:00:00Z",
};

// Default project card with active runs
export const Default: Story = {
  args: {
    project: sampleProject,
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Project with no active runs
export const NoActiveRuns: Story = {
  args: {
    project: {
      ...sampleProject,
      active_runs: 0,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Project with single active run
export const SingleRun: Story = {
  args: {
    project: {
      ...sampleProject,
      active_runs: 1,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Project with many active runs
export const ManyRuns: Story = {
  args: {
    project: {
      ...sampleProject,
      repo_name: "large-training-project",
      active_runs: 15,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Organization project
export const OrganizationProject: Story = {
  args: {
    project: orgProject,
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Long repo name
export const LongRepoName: Story = {
  args: {
    project: {
      ...sampleProject,
      repo_name: "very-long-repository-name-that-might-overflow",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[350px]">
        <Story />
      </div>
    ),
  ],
};

// Skeleton loading state
export const Skeleton: Story = {
  render: () => (
    <div className="w-[350px]">
      <ProjectCardSkeleton />
    </div>
  ),
};

// Grid of cards
export const GridLayout: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[720px]">
      <ProjectCard project={sampleProject} />
      <ProjectCard project={{ ...sampleProject, id: 2, active_runs: 0 }} />
      <ProjectCard project={orgProject} />
      <ProjectCard
        project={{
          ...sampleProject,
          id: 4,
          repo_name: "experimental-models",
          active_runs: 5,
        }}
      />
    </div>
  ),
};

// Grid with skeletons
export const GridWithSkeletons: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[720px]">
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
      <ProjectCardSkeleton />
    </div>
  ),
};
