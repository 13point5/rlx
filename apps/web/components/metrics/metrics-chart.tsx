"use client";

import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getAvailableMetrics, getMetricSeries } from "@/app/actions/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo } from "react";

// Color palette for multiple metrics
const CHART_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

// Common metric groups to show by default
const DEFAULT_METRIC_GROUPS = [
  { label: "Reward", patterns: ["reward/mean", "val_reward/mean"] },
  { label: "Loss", patterns: ["loss/mean"] },
  { label: "Performance", patterns: ["perf/throughput", "perf/mfu"] },
  { label: "Optimizer", patterns: ["optim/lr", "optim/grad_norm"] },
];

interface MetricsChartProps {
  runId: number;
  refreshInterval?: number;
}

export function MetricsChart({ runId, refreshInterval = 10000 }: MetricsChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Fetch available metrics
  const { data: availableMetrics, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-metrics", runId],
    queryFn: async () => {
      const response = await getAvailableMetrics(runId);
      if (!response.success) throw new Error(response.error);
      return response.data?.metrics ?? [];
    },
    refetchInterval: refreshInterval,
  });

  // Auto-select default metrics when available
  useMemo(() => {
    if (availableMetrics && availableMetrics.length > 0 && selectedMetrics.length === 0) {
      // Find first matching metric from default groups
      const defaults: string[] = [];
      for (const group of DEFAULT_METRIC_GROUPS) {
        for (const pattern of group.patterns) {
          if (availableMetrics.includes(pattern) && !defaults.includes(pattern)) {
            defaults.push(pattern);
            break;
          }
        }
      }
      if (defaults.length > 0) {
        setSelectedMetrics(defaults.slice(0, 3)); // Max 3 by default
      } else if (availableMetrics.length > 0) {
        setSelectedMetrics([availableMetrics[0]]);
      }
    }
  }, [availableMetrics, selectedMetrics.length]);

  // Fetch data for selected metrics
  const { data: metricsData, isLoading: loadingData } = useQuery({
    queryKey: ["metric-series", runId, selectedMetrics],
    queryFn: async () => {
      if (selectedMetrics.length === 0) return [];

      const results = await Promise.all(
        selectedMetrics.map(async (metricName) => {
          const response = await getMetricSeries(runId, metricName, { limit: 500 });
          if (!response.success) return { metricName, data: [] };
          return { metricName, data: response.data?.data ?? [] };
        })
      );
      return results;
    },
    enabled: selectedMetrics.length > 0,
    refetchInterval: refreshInterval,
  });

  // Transform data for recharts (merge by step)
  const chartData = useMemo(() => {
    if (!metricsData || metricsData.length === 0) return [];

    // Collect all steps
    const stepMap = new Map<number, Record<string, number>>();

    for (const { metricName, data } of metricsData) {
      for (const point of data) {
        const step = point.step ?? 0;
        if (!stepMap.has(step)) {
          stepMap.set(step, { step });
        }
        const entry = stepMap.get(step)!;
        entry[metricName] = point.value;
      }
    }

    // Sort by step and return
    return Array.from(stepMap.values()).sort((a, b) => a.step - b.step);
  }, [metricsData]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    );
  };

  if (loadingAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Loading available metrics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!availableMetrics || availableMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            No metrics recorded yet. Metrics will appear once training starts logging data.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metric selector */}
        <div className="flex flex-wrap gap-2">
          {availableMetrics.map((metric) => (
            <button
              key={metric}
              onClick={() => toggleMetric(metric)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                selectedMetrics.includes(metric)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {metric}
            </button>
          ))}
        </div>

        {/* Chart */}
        {loadingData ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Loading chart data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Select metrics to display
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="step"
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                  tickLine={{ stroke: "currentColor" }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                  tickLine={{ stroke: "currentColor" }}
                  tickFormatter={(value) =>
                    typeof value === "number"
                      ? value < 0.01 && value > 0
                        ? value.toExponential(1)
                        : value.toFixed(2)
                      : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    value.toFixed(4),
                    name,
                  ]}
                />
                <Legend />
                {selectedMetrics.map((metric, index) => (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={metric}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
