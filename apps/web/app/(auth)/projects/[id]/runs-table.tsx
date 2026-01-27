"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RunRecord, RunStatusBatchResponse } from "@/lib/types";

interface RunsTableProps {
  projectId: string;
  runs: RunRecord[];
  statusMap: RunStatusBatchResponse;
  statusMessage: string | null;
}

export function RunsTable({
  projectId,
  runs,
  statusMap,
  statusMessage,
}: RunsTableProps) {
  return (
    <div className="space-y-4">
      {statusMessage && <p className="text-sm text-destructive">{statusMessage}</p>}
      <div className="border border-border overflow-hidden rounded-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>GPU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  No runs yet.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => {
                const liveStatus = statusMap[run.id]?.status;
                const status = liveStatus ?? run.status;
                const rowHref = `/projects/${projectId}/runs/${run.id}`;

                return (
                  <TableRow key={run.id} className="cursor-pointer">
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="flex h-full w-full items-center px-2 py-2 font-medium hover:underline"
                      >
                        {run.name}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="block h-full w-full px-2 py-2 text-muted-foreground"
                      >
                        {run.config_name}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="flex h-full w-full items-center gap-1.5 px-2 py-2 text-muted-foreground whitespace-nowrap"
                      >
                        <GitBranch className="size-3" />
                        <span className="max-w-[120px] truncate">
                          {run.branch}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="block h-full w-full px-2 py-2 text-muted-foreground whitespace-nowrap"
                      >
                        {run.gpu_type} x{run.gpu_count}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="flex h-full w-full items-center px-2 py-2"
                      >
                        <StatusBadge status={status} />
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        href={rowHref}
                        className="block h-full w-full px-2 py-2 text-muted-foreground whitespace-nowrap"
                      >
                        {new Date(run.created_at).toLocaleString()}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colors = {
    active: "bg-green-500/10 text-green-500 border-green-500/30",
    provisioning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    error: "bg-red-500/10 text-red-500 border-red-500/30",
    stopped: "bg-gray-500/10 text-gray-500 border-gray-500/30",
    terminated: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-none border px-2 py-0.5 text-xs capitalize ${
        colors[normalized as keyof typeof colors] ?? colors.pending
      }`}
    >
      {normalized}
    </span>
  );
}
