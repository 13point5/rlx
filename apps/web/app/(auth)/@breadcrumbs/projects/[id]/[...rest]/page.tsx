import Link from "next/link";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getProject } from "@/lib/cached-api";

interface Props {
  params: Promise<{
    id: string;
    rest: string[];
  }>;
}

export default async function ProjectNestedBreadcrumbs({ params }: Props) {
  const { id, rest } = await params;

  // Fetch project name (uses cached version - no duplicate fetch)
  const projectResult = await getProject(Number(id));
  const projectName = projectResult.project?.repo_name || `Project ${id}`;

  // Build breadcrumbs from remaining segments
  const segments = rest.map((segment, index) => ({
    label: formatSegment(segment),
    href: `/projects/${id}/${rest.slice(0, index + 1).join("/")}`,
    isLast: index === rest.length - 1,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/projects/${id}`}>{projectName}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment) => (
          <React.Fragment key={segment.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {segment.isLast ? (
                <BreadcrumbPage>{segment.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={segment.href}>{segment.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function formatSegment(segment: string): string {
  // "new-run" → "New Run"
  // "runs" → "Runs"
  // "123" → "123"
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
