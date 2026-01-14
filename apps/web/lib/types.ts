export type GitHubOwnerType = "User" | "Organization";

export type GitHubOwner = {
  username: string;
  avatar_url: string;
  type: GitHubOwnerType;
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

export type GpuSummaryPrice = {
   onDemand: number | null;
   communityPrice: number | null;
   spotPrice: number | null;
};

export type GpuSummaryRegionPricing = Record<string, GpuSummaryPrice | string>;

export type GpuSummaryData = Record<string, GpuSummaryRegionPricing>;

export interface BreadcrumbItem {
   label: string;
   href?: string;
   icon?: {
     src: string;
     alt: string;
     type: GitHubOwnerType;
   };
   items?: {
     label: string;
     href: string;
     active?: boolean;
     icon?: {
       src: string;
       alt: string;
       type: GitHubOwnerType;
     };
   }[];
}

