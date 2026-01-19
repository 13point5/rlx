import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GitBranch, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
  TableCaption,
} from "./table";
import { Badge } from "./badge";
import { Button } from "./button";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

// Sample data
const runs = [
  {
    id: 1,
    name: "training-run-1",
    branch: "main",
    gpu: "A100 x4",
    status: "active",
    created: "2024-01-15",
  },
  {
    id: 2,
    name: "training-run-2",
    branch: "feature/new-model",
    gpu: "H100 x8",
    status: "pending",
    created: "2024-01-14",
  },
  {
    id: 3,
    name: "experiment-alpha",
    branch: "develop",
    gpu: "A100 x2",
    status: "error",
    created: "2024-01-13",
  },
  {
    id: 4,
    name: "fine-tune-gpt",
    branch: "main",
    gpu: "A100 x4",
    status: "stopped",
    created: "2024-01-12",
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/10 text-green-500 border-green-500/30",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    error: "bg-red-500/10 text-red-500 border-red-500/30",
    stopped: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-none border px-2 py-0.5 text-xs capitalize ${
        colors[status] ?? colors.pending
      }`}
    >
      {status}
    </span>
  );
}

// Default table
export const Default: Story = {
  render: () => (
    <div className="w-[700px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>GPU</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <GitBranch className="size-3" />
                  <span className="max-w-[120px] truncate">{run.branch}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{run.gpu}</TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {run.created}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

// With caption
export const WithCaption: Story = {
  render: () => (
    <div className="w-[700px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableCaption>A list of your recent training runs.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>GPU</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.slice(0, 3).map((run) => (
            <TableRow key={run.id}>
              <TableCell className="font-medium">{run.name}</TableCell>
              <TableCell>{run.branch}</TableCell>
              <TableCell>{run.gpu}</TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

// With footer
export const WithFooter: Story = {
  render: () => (
    <div className="w-[600px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">GPU Hours (A100)</TableCell>
            <TableCell>120</TableCell>
            <TableCell className="text-right">$360.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">GPU Hours (H100)</TableCell>
            <TableCell>48</TableCell>
            <TableCell className="text-right">$192.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Storage (TB)</TableCell>
            <TableCell>2</TableCell>
            <TableCell className="text-right">$20.00</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-medium">$572.00</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};

// Clickable rows
export const ClickableRows: Story = {
  render: () => (
    <div className="w-[700px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>GPU</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id} className="cursor-pointer">
              <TableCell>
                <div className="font-medium hover:underline">{run.name}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <GitBranch className="size-3" />
                  {run.branch}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{run.gpu}</TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

// Empty state
export const EmptyState: Story = {
  render: () => (
    <div className="w-[700px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>GPU</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
              No runs yet. Create your first run to get started.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
};

// Simple table
export const SimpleTable: Story = {
  render: () => (
    <div className="w-[400px] border border-border rounded-none overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Model</TableCell>
            <TableCell className="text-muted-foreground">GPT-4</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Batch Size</TableCell>
            <TableCell className="text-muted-foreground">32</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Learning Rate</TableCell>
            <TableCell className="text-muted-foreground">0.001</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Epochs</TableCell>
            <TableCell className="text-muted-foreground">100</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
};
