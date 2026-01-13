// Consolidated type definitions - single source of truth

export type GitHubOwnerType = "user" | "organization";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: {
    src: string;
    alt: string;
    rounded?: "full" | "sm";
  };
  items?: {
    label: string;
    href: string;
    active?: boolean;
    icon?: { src: string; alt: string; rounded?: "full" | "sm" };
  }[];
}

export type Project = {
  id: number;
  repo_id: number;
  repo_name: string;
  repo_owner: string;
  repo_owner_type: GitHubOwnerType;
  repo_url: string;
  repo_full_name: string;
  active_runs: number;
  created_at: string;
  updated_at: string | null;
};

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner_username: string;
  owner_type: GitHubOwnerType;
  owner_avatar_url: string;
};

export type GitHubOwner = {
  username: string;
  avatar_url: string;
  type: GitHubOwnerType;
};

export type GitHubReposResponse = {
  repos: GitHubRepo[];
  page: number;
  per_page: number;
  has_more: boolean;
  username: string | null;
};

export type GitHubConnectionStatus = {
  connected: boolean;
  username?: string;
};
