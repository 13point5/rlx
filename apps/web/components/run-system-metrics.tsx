"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge,
  Thermometer,
  Zap,
} from "lucide-react";

// TODO: Replace with real-time system metrics from API
const mockSystemMetrics = {
  gpu: {
    utilization: 87,
    memory: 68.5,
    temperature: 72,
    power: 280,
    maxPower: 400,
  },
  cpu: {
    utilization: 34,
    cores: 32,
    activeCores: 8,
    temperature: 58,
  },
  memory: {
    used: 48.3,
    total: 256,
    utilization: 18.9,
  },
  disk: {
    used: 1240,
    total: 2000,
    utilization: 62,
    iops: 2450,
  },
  network: {
    upload: 125.4,
    download: 342.7,
  },
};

const gpuUtilizationHistory = [
  { time: "12:00", value: 45 },
  { time: "12:05", value: 62 },
  { time: "12:10", value: 78 },
  { time: "12:15", value: 82 },
  { time: "12:20", value: 85 },
  { time: "12:25", value: 87 },
];

const memoryHistory = [
  { time: "12:00", value: 12.5 },
  { time: "12:05", value: 24.3 },
  { time: "12:10", value: 45.8 },
  { time: "12:15", value: 56.2 },
  { time: "12:20", value: 64.1 },
  { time: "12:25", value: 68.5 },
];

interface RunSystemMetricsProps {
  runId: string;
}

export function RunSystemMetrics({ runId }: RunSystemMetricsProps) {
  return (
    <div className="space-y-4">
      {/* GPU Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="size-5" />
            GPU Metrics (NVIDIA H100)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricGauge
              label="GPU Utilization"
              value={mockSystemMetrics.gpu.utilization}
              max={100}
              unit="%"
              icon={Gauge}
              color="primary"
            />
            <MetricGauge
              label="Memory Usage"
              value={mockSystemMetrics.gpu.memory}
              max={80}
              unit="GB"
              icon={MemoryStick}
              color="blue"
            />
            <MetricGauge
              label="Temperature"
              value={mockSystemMetrics.gpu.temperature}
              max={85}
              unit="°C"
              icon={Thermometer}
              color="orange"
            />
            <MetricGauge
              label="Power Draw"
              value={mockSystemMetrics.gpu.power}
              max={mockSystemMetrics.gpu.maxPower}
              unit="W"
              icon={Zap}
              color="yellow"
            />
          </div>

          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium">GPU Utilization History</h4>
            <MiniBarChart data={gpuUtilizationHistory} color="hsl(var(--primary))" />
          </div>
        </CardContent>
      </Card>

      {/* CPU & Memory */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4" />
              CPU
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <MetricGauge
                label="Utilization"
                value={mockSystemMetrics.cpu.utilization}
                max={100}
                unit="%"
                size="sm"
              />
              <MetricGauge
                label="Temperature"
                value={mockSystemMetrics.cpu.temperature}
                max={85}
                unit="°C"
                size="sm"
              />
            </div>
            <div className="space-y-2">
              <MetricRow
                label="Total Cores"
                value={mockSystemMetrics.cpu.cores}
              />
              <MetricRow
                label="Active Cores"
                value={mockSystemMetrics.cpu.activeCores}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MemoryStick className="size-4" />
              System Memory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricGauge
              label="Memory Usage"
              value={mockSystemMetrics.memory.used}
              max={mockSystemMetrics.memory.total}
              unit="GB"
              showPercentage
              size="md"
            />
            <div className="space-y-2">
              <MetricRow
                label="Total Memory"
                value={`${mockSystemMetrics.memory.total} GB`}
              />
              <MetricRow
                label="Utilization"
                value={`${mockSystemMetrics.memory.utilization}%`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disk & Network */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="size-4" />
              Disk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricGauge
              label="Disk Usage"
              value={mockSystemMetrics.disk.used}
              max={mockSystemMetrics.disk.total}
              unit="GB"
              showPercentage
              size="md"
            />
            <div className="space-y-2">
              <MetricRow label="IOPS" value={mockSystemMetrics.disk.iops.toLocaleString()} />
              <MetricRow
                label="Total Space"
                value={`${mockSystemMetrics.disk.total} GB`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Network
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Upload</p>
                <p className="text-2xl font-bold">
                  {mockSystemMetrics.network.upload}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    MB/s
                  </span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Download</p>
                <p className="text-2xl font-bold">
                  {mockSystemMetrics.network.download}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    MB/s
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GPU Memory History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GPU Memory History</CardTitle>
        </CardHeader>
        <CardContent>
          <MiniBarChart data={memoryHistory} color="hsl(217.2 91.2% 59.8%)" />
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricGaugeProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  icon?: React.ElementType;
  color?: "primary" | "blue" | "orange" | "yellow";
  showPercentage?: boolean;
  size?: "sm" | "md";
}

function MetricGauge({
  label,
  value,
  max,
  unit = "",
  icon: Icon,
  color = "primary",
  showPercentage = false,
  size = "sm",
}: MetricGaugeProps) {
  const percentage = (value / max) * 100;

  const colorMap = {
    primary: "bg-primary",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    yellow: "bg-yellow-500",
  };

  const gaugeColor = colorMap[color];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {Icon && <Icon className="mr-1 inline size-3" />}
          {label}
        </span>
        <span className="text-sm font-bold">
          {value}
          {unit}
          {showPercentage && ` (${percentage.toFixed(1)}%)`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-secondary">
        <div
          className={`h-2 rounded-full ${gaugeColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface MiniBarChartProps {
  data: Array<{ time: string; value: number }>;
  color?: string;
}

function MiniBarChart({
  data,
  color = "hsl(var(--primary))",
}: MiniBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2" style={{ height: "120px" }}>
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 100;
          return (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-end justify-center" style={{ height: "100px" }}>
                <div
                  className="w-full rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${height}%`,
                    backgroundColor: color,
                  }}
                  title={`${item.time}: ${item.value}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0].time}</span>
        <span>{data[data.length - 1].time}</span>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}
