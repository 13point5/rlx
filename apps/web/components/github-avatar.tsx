import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GitHubOwnerType } from "@/lib/types";

interface GitHubAvatarProps {
  username: string;
  avatarUrl: string;
  type: GitHubOwnerType;
  size?: number;
  className?: string;
}

/**
 * Reusable GitHub avatar component that automatically handles shape:
 * - Organizations: Square with rounded corners
 * - Users: Circular
 */
export function GitHubAvatar({
  username,
  avatarUrl,
  type,
  size = 20,
  className,
}: GitHubAvatarProps) {
  const isOrg = type === "Organization";

  return (
    <Image
      src={avatarUrl}
      alt={username}
      width={size}
      height={size}
      className={cn(
        "shrink-0",
        isOrg ? "rounded" : "rounded-full",
        className
      )}
    />
  );
}

interface GitHubOwnerWithLabelProps {
  username: string;
  avatarUrl: string;
  type: GitHubOwnerType;
  size?: number;
  showOrgLabel?: boolean;
  className?: string;
}

/**
 * GitHub avatar with username text, optionally showing "(org)" label
 */
export function GitHubOwnerWithLabel({
  username,
  avatarUrl,
  type,
  size = 20,
  showOrgLabel = true,
  className,
}: GitHubOwnerWithLabelProps) {
  const isOrg = type === "Organization";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <GitHubAvatar
        username={username}
        avatarUrl={avatarUrl}
        type={type}
        size={size}
      />
      <span>{username}</span>
      {isOrg && showOrgLabel && (
        <span className="text-xs text-muted-foreground">(org)</span>
      )}
    </div>
  );
}
