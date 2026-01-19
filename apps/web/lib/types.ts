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

// GPU Availability Types
export interface GpuInstancePrices {
  currency: string;
  onDemand: number | null;
  communityPrice: number | null;
  isVariable: boolean;
}

export interface GpuInstance {
  cloudId: string;
  gpuType: string;
  socket: string;
  provider: string;
  gpuCount: number;
  gpuMemory: number;
  security: string;
  prices: GpuInstancePrices;
  images: string[];
  region: string;
  dataCenter: string;
  country: string;
  stockStatus: string;
  provisioningTime?: number | null;
  vcpu?: { defaultCount: number };
  memory?: { defaultCount: number };
  disk?: {
    minCount: number;
    defaultCount: number;
    maxCount: number;
    pricePerUnit: number;
  };
  isSpot?: boolean;
}

export interface GpuAvailabilityResponse {
  items: GpuInstance[];
  totalCount: number;
}

export type RunInstanceSelection = Pick<
  GpuInstance,
  "cloudId" | "gpuType" | "socket" | "provider" | "region" | "dataCenter" | "country" | "gpuCount" | "security" | "gpuMemory" | "isSpot"
>;

export interface RunRecord {
  id: number;
  project_id: number;
  name: string;
  status: string;
  branch: string;
  config_path: string;
  provider: string;
  region: string;
  data_center: string | null;
  gpu_type: string;
  gpu_count: number;
  security: string;
  cloud_id: string;
  created_at: string;
  updated_at: string | null;
  is_spot?: boolean;
}

export interface RunStatusItem {
  status: string;
  ssh_connection: string | null;
  ip: string | null;
}

export type RunStatusBatchResponse = Record<string, RunStatusItem>;

export interface RunStatusResponse {
  status: string;
  ssh_connection: string | null;
  ip: string | null;
}

export interface RunStatusErrorPayload {
  message: string;
  last_known_status: string;
  last_updated_at: string | null;
}

export interface RunTerminateResponse {
  status: string;
  pod_id: string;
}

// SSH Key Types
export interface SSHKeyStatus {
  configured: boolean;
  keys: SSHKeyResponse[];
}

export interface SSHKeyResponse {
  id: number;
  public_key: string;
  prime_ssh_key_id: string;
  created_at: string;
}
