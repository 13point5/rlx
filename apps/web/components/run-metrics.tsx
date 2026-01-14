"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Zap,
  Target,
} from "lucide-react";

// TODO: Replace with actual API call and real charting library (recharts/visx)
const mockMetrics = {
  avgReward: {
    current: 245.3,
    change: 12.5,
    trend: "up" as const,
  },
  episodeLength: {
    current: 1823,
    change: -3.2,
    trend: "down" as const,
  },
  loss: {
    current: 0.0432,
    change: -15.7,
    trend: "down" as const,
  },
  successRate: {
    current: 87.3,
    change: 5.1,
    trend: "up" as const,
  },
};

const rewardData = [
  { step: 0, value: 120 },
  { step: 1000, value: 145 },
  { step: 2000, value: 168 },
  { step: 3000, value: 182 },
  { step: 4000, value: 201 },
  { step: 5000, value: 223 },
  { step: 6000, value: 235 },
  { step: 6500, value: 245 },
];

const lossData = [
  { step: 0, value: 0.245 },
  { step: 1000, value: 0.189 },
  { step: 2000, value: 0.134 },
  { step: 3000, value: 0.098 },
  { step: 4000, value: 0.076 },
  { step: 5000, value: 0.058 },
  { step: 6000, value: 0.047 },
  { step: 6500, value: 0.043 },
];

interface RunMetricsProps {
  runId: string;
}

export function RunMetrics({ runId }: RunMetricsProps) {
  return (
    <div className="space-y-4">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Avg Reward"
          value={mockMetrics.avgReward.current}
          change={mockMetrics.avgReward.change}
          trend={mockMetrics.avgReward.trend}
          icon={Award}
        />
        <MetricCard
          title="Episode Length"
          value={mockMetrics.episodeLength.current}
          change={mockMetrics.episodeLength.change}
          trend={mockMetrics.episodeLength.trend}
          icon={Activity}
          format="number"
        />
        <MetricCard
          title="Loss"
          value={mockMetrics.loss.current}
          change={mockMetrics.loss.change}
          trend={mockMetrics.loss.trend}
          icon={Zap}
          decimals={4}
        />
        <MetricCard
          title="Success Rate"
          value={mockMetrics.successRate.current}
          change={mockMetrics.successRate.change}
          trend={mockMetrics.successRate.trend}
          icon={Target}
          suffix="%"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Reward</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniLineChart data={rewardData} color="hsl(var(--primary))" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniLineChart data={lossData} color="hsl(142.1 76.2% 36.3%)" />
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <MetricRow label="Learning Rate" value="3e-4" />
            <MetricRow label="Entropy Coefficient" value="0.01" />
            <MetricRow label="Value Loss Coefficient" value="0.5" />
            <MetricRow label="Gamma (Discount)" value="0.99" />
            <MetricRow label="Clip Range" value="0.2" />
            <MetricRow label="Batch Size" value="256" />
            <MetricRow label="Mini-batch Size" value="64" />
            <MetricRow label="Episodes Completed" value="1,247" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  change: number;
  trend: "up" | "down";
  icon: React.ElementType;
  decimals?: number;
  suffix?: string;
  format?: "number" | "decimal";
}

function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  decimals = 1,
  suffix = "",
  format = "decimal",
}: MetricCardProps) {
  const isPositive = change > 0;
  const displayValue =
    format === "number"
      ? value.toLocaleString()
      : value.toFixed(decimals) + suffix;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{displayValue}</p>
          <div className="flex items-center gap-1 text-xs">
            {trend === "up" ? (
              <TrendingUp
                className={`size-3 ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              />
            ) : (
              <TrendingDown
                className={`size-3 ${
                  isPositive ? "text-red-500" : "text-green-500"
                }`}
              />
            )}
            <span
              className={
                isPositive === (trend === "up")
                  ? "text-green-500"
                  : "text-red-500"
              }
            >
              {isPositive ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs previous checkpoint</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MiniLineChartProps {
  data: Array<{ step: number; value: number }>;
  color?: string;
}

function MiniLineChart({ data, color = "hsl(var(--primary))" }: MiniLineChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue;

  const height = 200;
  const width = 600;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y =
      height -
      padding -
      ((d.value - minValue) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(" L ")}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: "200px" }}
      >
        {/* Grid lines */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />

        {/* Area fill */}
        <path
          d={`${pathData} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
          fill={color}
          fillOpacity="0.1"
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((point, i) => {
          const [x, y] = point.split(",").map(Number);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={color}
              className="transition-all hover:r-5"
            />
          );
        })}
      </svg>

      {/* Labels */}
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Step {data[0].step.toLocaleString()}</span>
        <span>Step {data[data.length - 1].step.toLocaleString()}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}
