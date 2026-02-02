"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getRunSamples } from "@/app/actions/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SampleRecord, TrajectoryStep } from "@/lib/types";

interface RolloutsPanelProps {
  runId: number;
  refreshInterval?: number;
}

export function RolloutsPanel({ runId, refreshInterval = 30000 }: RolloutsPanelProps) {
  const [selectedSample, setSelectedSample] = useState<SampleRecord | null>(null);
  const [limit] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["run-samples", runId, limit],
    queryFn: async () => {
      const response = await getRunSamples(runId, { limit });
      if (!response.success) throw new Error(response.error);
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rollouts / Samples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            Loading samples...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rollouts / Samples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            {error ? `Error: ${error.message}` : "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.samples.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rollouts / Samples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No samples recorded yet. Samples will appear once training starts logging rollouts.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Rollouts / Samples</span>
            <span className="text-xs text-muted-foreground font-normal">
              {data.total} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.samples.map((sample) => (
              <button
                key={sample.id}
                onClick={() => setSelectedSample(selectedSample?.id === sample.id ? null : sample)}
                className={`w-full text-left rounded-md border p-3 transition-colors hover:bg-muted/50 ${
                  selectedSample?.id === sample.id ? "border-primary bg-muted/50" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Step {sample.step}</Badge>
                    {sample.task && (
                      <Badge variant="secondary">{sample.task}</Badge>
                    )}
                    {sample.example_id && (
                      <span className="text-xs text-muted-foreground truncate max-w-32">
                        {sample.example_id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {sample.reward !== null && (
                      <span
                        className={`text-xs font-mono ${
                          sample.reward >= 0 ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        R: {sample.reward.toFixed(3)}
                      </span>
                    )}
                    {sample.advantage !== null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        A: {sample.advantage.toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sample Detail View */}
      {selectedSample && (
        <SampleDetail sample={selectedSample} onClose={() => setSelectedSample(null)} />
      )}
    </div>
  );
}

interface SampleDetailProps {
  sample: SampleRecord;
  onClose: () => void;
}

function SampleDetail({ sample, onClose }: SampleDetailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Sample Details - Step {sample.step}</span>
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-xs">Reward</div>
            <div className="font-mono">
              {sample.reward !== null ? sample.reward.toFixed(4) : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Advantage</div>
            <div className="font-mono">
              {sample.advantage !== null ? sample.advantage.toFixed(4) : "—"}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Task</div>
            <div>{sample.task || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Example ID</div>
            <div className="truncate">{sample.example_id || "—"}</div>
          </div>
        </div>

        {/* Answer */}
        {sample.answer && (
          <div>
            <div className="text-muted-foreground text-xs mb-1">Answer</div>
            <div className="rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap">
              {sample.answer}
            </div>
          </div>
        )}

        {/* Trajectory */}
        {sample.trajectory && sample.trajectory.length > 0 && (
          <div>
            <div className="text-muted-foreground text-xs mb-2">
              Trajectory ({sample.trajectory.length} steps)
            </div>
            <div className="space-y-3">
              {sample.trajectory.map((step, index) => (
                <TrajectoryStepCard key={index} step={step} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Prompt/Completion (if no trajectory) */}
        {(!sample.trajectory || sample.trajectory.length === 0) && (
          <>
            {sample.prompt && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">Prompt</div>
                <div className="rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {typeof sample.prompt === "string"
                    ? sample.prompt
                    : JSON.stringify(sample.prompt, null, 2)}
                </div>
              </div>
            )}
            {sample.completion && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">Completion</div>
                <div className="rounded-md bg-muted p-3 text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {typeof sample.completion === "string"
                    ? sample.completion
                    : JSON.stringify(sample.completion, null, 2)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info/Metrics/Timing */}
        {(sample.info || sample.metrics || sample.timing) && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sample.info && Object.keys(sample.info).length > 0 && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">Info</div>
                <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {JSON.stringify(sample.info, null, 2)}
                </div>
              </div>
            )}
            {sample.metrics && Object.keys(sample.metrics).length > 0 && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">Metrics</div>
                <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {JSON.stringify(sample.metrics, null, 2)}
                </div>
              </div>
            )}
            {sample.timing && Object.keys(sample.timing).length > 0 && (
              <div>
                <div className="text-muted-foreground text-xs mb-1">Timing</div>
                <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {JSON.stringify(sample.timing, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TrajectoryStepCardProps {
  step: TrajectoryStep;
  index: number;
}

function TrajectoryStepCard({ step, index }: TrajectoryStepCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Step {index + 1}</span>
            {step.num_input_tokens !== null && (
              <span className="text-xs text-muted-foreground">
                {step.num_input_tokens} in
              </span>
            )}
            {step.num_output_tokens !== null && (
              <span className="text-xs text-muted-foreground">
                {step.num_output_tokens} out
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step.reward !== null && (
              <span
                className={`text-xs font-mono ${
                  step.reward >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                R: {step.reward.toFixed(3)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {expanded ? "▼" : "▶"}
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-muted-foreground text-xs mb-1">Prompt</div>
            <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
              {step.prompt}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs mb-1">Completion</div>
            <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
              {step.completion}
            </div>
          </div>
          {step.extras && Object.keys(step.extras).length > 0 && (
            <div>
              <div className="text-muted-foreground text-xs mb-1">Extras</div>
              <div className="rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(step.extras, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
