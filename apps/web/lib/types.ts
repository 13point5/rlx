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

export interface GitHubBranchesResponse {
  branches: string[];
  page: number;
  per_page: number;
  has_more: boolean;
}

// RLX Config Types
export interface RlxConfigEntry {
  name: string;
  description: string | null;
  config: string | null;
  inference: string | null;
  orchestrator: string | null;
  trainer: string | null;
  env_vars: Record<string, string> | null;
}

export interface RlxConfigResponse {
  configs: RlxConfigEntry[];
  found: boolean;
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
  | "cloudId"
  | "gpuType"
  | "socket"
  | "provider"
  | "region"
  | "dataCenter"
  | "country"
  | "gpuCount"
  | "security"
  | "gpuMemory"
  | "isSpot"
>;

export interface RunRecord {
  id: number;
  project_id: number;
  name: string;
  status: string;
  branch: string;
  config_name: string;
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

// W&B API Key Types
export interface WandbKeyStatus {
  configured: boolean;
  aws_region?: string | null;
}

// SSH Key Types
export interface SSHKeyStatus {
  configured: boolean;
  keys: SSHKeyResponse[];
  aws_region?: string | null;
}

export interface SSHKeyResponse {
  id: number;
  public_key: string;
  prime_ssh_key_id: string;
  name: string | null;
  created_at: string;
}

// Job Types
export type JobStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "TIMEOUT"
  | "CANCELLED";

export type JobType = "CLONE_REPO" | "LIST_FILES" | "CUSTOM_COMMAND";

export interface JobCommand {
  id: number;
  command: string;
  working_dir: string | null;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  sequence: number;
}

export interface JobResponse {
  id: number;
  run_id: number;
  job_type: JobType;
  status: JobStatus;
  config: Record<string, unknown>;
  celery_task_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  error_type: string | null;
  sequence: number;
}

export interface JobDetailResponse extends JobResponse {
  commands: JobCommand[];
}

export interface JobResultResponse {
  job_id: number;
  job_type: JobType;
  status: JobStatus;
  result: Record<string, unknown> | null;
}
