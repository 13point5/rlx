"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileCode,
  Copy,
  Download,
  ExternalLink,
  Settings,
  Layers,
  Zap,
} from "lucide-react";

// TODO: Replace with actual API call to fetch run configuration
const mockConfig = {
  file: "configs/ppo.yaml",
  algorithm: "PPO",
  environment: {
    name: "CartPole-v1",
    type: "gym",
    seed: 42,
  },
  model: {
    architecture: "MLP",
    hiddenLayers: [64, 64],
    activation: "tanh",
    normalization: "layer_norm",
  },
  training: {
    totalSteps: 10000,
    learningRate: 0.0003,
    batchSize: 256,
    miniBatchSize: 64,
    epochs: 10,
    gamma: 0.99,
    lambda: 0.95,
    clipRange: 0.2,
    valueClip: 0.2,
    entropyCoef: 0.01,
    valueLossCoef: 0.5,
    maxGradNorm: 0.5,
  },
  evaluation: {
    frequency: 500,
    episodes: 10,
  },
  checkpointing: {
    frequency: 500,
    keepLast: 5,
  },
  hardware: {
    device: "cuda",
    gpuType: "H100",
    numWorkers: 8,
  },
};

const yamlContent = `algorithm: PPO
environment:
  name: CartPole-v1
  type: gym
  seed: 42

model:
  architecture: MLP
  hidden_layers: [64, 64]
  activation: tanh
  normalization: layer_norm

training:
  total_steps: 10000
  learning_rate: 0.0003
  batch_size: 256
  mini_batch_size: 64
  epochs: 10
  gamma: 0.99
  lambda: 0.95
  clip_range: 0.2
  value_clip: 0.2
  entropy_coef: 0.01
  value_loss_coef: 0.5
  max_grad_norm: 0.5

evaluation:
  frequency: 500
  episodes: 10

checkpointing:
  frequency: 500
  keep_last: 5

hardware:
  device: cuda
  gpu_type: H100
  num_workers: 8`;

interface RunConfigProps {
  runId: string;
  config: string;
}

export function RunConfig({ runId, config }: RunConfigProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = config.split("/").pop() || "config.yaml";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileCode className="size-5" />
              Configuration File
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="size-3" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="size-3" />
                Download
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="size-3" />
                View in Repo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{config}</span>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="size-4" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection
              items={[
                { label: "Name", value: mockConfig.environment.name },
                { label: "Type", value: mockConfig.environment.type },
                { label: "Seed", value: mockConfig.environment.seed },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" />
              Model Architecture
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection
              items={[
                { label: "Architecture", value: mockConfig.model.architecture },
                {
                  label: "Hidden Layers",
                  value: mockConfig.model.hiddenLayers.join(", "),
                },
                { label: "Activation", value: mockConfig.model.activation },
                {
                  label: "Normalization",
                  value: mockConfig.model.normalization,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4" />
            Training Hyperparameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ConfigSection
              items={[
                {
                  label: "Total Steps",
                  value: mockConfig.training.totalSteps.toLocaleString(),
                },
                { label: "Learning Rate", value: mockConfig.training.learningRate },
                { label: "Batch Size", value: mockConfig.training.batchSize },
                {
                  label: "Mini-batch Size",
                  value: mockConfig.training.miniBatchSize,
                },
              ]}
            />
            <ConfigSection
              items={[
                { label: "Epochs", value: mockConfig.training.epochs },
                { label: "Gamma", value: mockConfig.training.gamma },
                { label: "Lambda", value: mockConfig.training.lambda },
                { label: "Clip Range", value: mockConfig.training.clipRange },
              ]}
            />
            <ConfigSection
              items={[
                { label: "Value Clip", value: mockConfig.training.valueClip },
                {
                  label: "Entropy Coef",
                  value: mockConfig.training.entropyCoef,
                },
                {
                  label: "Value Loss Coef",
                  value: mockConfig.training.valueLossCoef,
                },
                {
                  label: "Max Grad Norm",
                  value: mockConfig.training.maxGradNorm,
                },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection
              items={[
                { label: "Frequency", value: mockConfig.evaluation.frequency },
                { label: "Episodes", value: mockConfig.evaluation.episodes },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checkpointing</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection
              items={[
                {
                  label: "Frequency",
                  value: mockConfig.checkpointing.frequency,
                },
                { label: "Keep Last", value: mockConfig.checkpointing.keepLast },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hardware</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfigSection
              items={[
                { label: "Device", value: mockConfig.hardware.device },
                { label: "GPU Type", value: mockConfig.hardware.gpuType },
                { label: "Workers", value: mockConfig.hardware.numWorkers },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Raw YAML */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[400px] overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">
            {yamlContent}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

interface ConfigSectionProps {
  items: Array<{ label: string; value: string | number }>;
}

function ConfigSection({ items }: ConfigSectionProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0"
        >
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <span className="font-mono text-sm font-medium">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
