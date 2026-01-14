"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Search,
  Pause,
  Play,
  Terminal,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";

// TODO: Replace with real-time log streaming from API
const mockLogs = [
  {
    timestamp: "2024-01-14T12:30:45.123Z",
    level: "info",
    message: "Initializing training environment...",
  },
  {
    timestamp: "2024-01-14T12:30:46.234Z",
    level: "info",
    message: "Loading configuration from configs/ppo.yaml",
  },
  {
    timestamp: "2024-01-14T12:30:47.345Z",
    level: "info",
    message: "Environment: CartPole-v1",
  },
  {
    timestamp: "2024-01-14T12:30:48.456Z",
    level: "info",
    message: "GPU device: NVIDIA H100 (80GB)",
  },
  {
    timestamp: "2024-01-14T12:30:49.567Z",
    level: "success",
    message: "Model initialized successfully",
  },
  {
    timestamp: "2024-01-14T12:30:50.678Z",
    level: "info",
    message: "Starting training loop...",
  },
  {
    timestamp: "2024-01-14T12:30:55.789Z",
    level: "info",
    message: "Step 100/10000 | Reward: 124.5 | Loss: 0.234",
  },
  {
    timestamp: "2024-01-14T12:31:00.890Z",
    level: "info",
    message: "Step 200/10000 | Reward: 145.2 | Loss: 0.198",
  },
  {
    timestamp: "2024-01-14T12:31:05.901Z",
    level: "warning",
    message: "Episode terminated early at step 156",
  },
  {
    timestamp: "2024-01-14T12:31:10.012Z",
    level: "info",
    message: "Step 300/10000 | Reward: 168.7 | Loss: 0.176",
  },
  {
    timestamp: "2024-01-14T12:31:15.123Z",
    level: "success",
    message: "Checkpoint saved at step 500",
  },
  {
    timestamp: "2024-01-14T12:31:20.234Z",
    level: "info",
    message: "Step 500/10000 | Reward: 189.3 | Loss: 0.145",
  },
  {
    timestamp: "2024-01-14T12:31:25.345Z",
    level: "error",
    message: "NaN detected in gradient computation",
  },
  {
    timestamp: "2024-01-14T12:31:30.456Z",
    level: "info",
    message: "Recovering from error, reinitializing optimizer",
  },
  {
    timestamp: "2024-01-14T12:31:35.567Z",
    level: "success",
    message: "Recovery successful, resuming training",
  },
];

interface RunLogsProps {
  runId: string;
}

export function RunLogs({ runId }: RunLogsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = log.message
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesLevel =
      selectedLevel === "all" || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="size-5" />
              Training Logs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? (
                  <>
                    <Play className="size-3" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="size-3" />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="size-3" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <LevelFilter
                level="all"
                selected={selectedLevel === "all"}
                onClick={() => setSelectedLevel("all")}
                count={mockLogs.length}
              />
              <LevelFilter
                level="info"
                selected={selectedLevel === "info"}
                onClick={() => setSelectedLevel("info")}
                count={mockLogs.filter((l) => l.level === "info").length}
              />
              <LevelFilter
                level="success"
                selected={selectedLevel === "success"}
                onClick={() => setSelectedLevel("success")}
                count={mockLogs.filter((l) => l.level === "success").length}
              />
              <LevelFilter
                level="warning"
                selected={selectedLevel === "warning"}
                onClick={() => setSelectedLevel("warning")}
                count={mockLogs.filter((l) => l.level === "warning").length}
              />
              <LevelFilter
                level="error"
                selected={selectedLevel === "error"}
                onClick={() => setSelectedLevel("error")}
                count={mockLogs.filter((l) => l.level === "error").length}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Viewer */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                No logs found matching your filters
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredLogs.map((log, index) => (
                  <LogLine key={index} {...log} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface LogLineProps {
  timestamp: string;
  level: string;
  message: string;
}

function LogLine({ timestamp, level, message }: LogLineProps) {
  const time = new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  const levelConfig = {
    info: {
      icon: Info,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    success: {
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    warning: {
      icon: AlertCircle,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  };

  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.info;
  const Icon = config.icon;

  return (
    <div className="group flex items-start gap-3 px-4 py-2 hover:bg-muted/50">
      <span className="mt-0.5 text-xs text-muted-foreground">{time}</span>
      <div
        className={`mt-0.5 flex items-center gap-1.5 rounded px-1.5 py-0.5 ${config.bg}`}
      >
        <Icon className={`size-3 ${config.color}`} />
        <span className={`text-xs font-medium uppercase ${config.color}`}>
          {level}
        </span>
      </div>
      <span className="flex-1 whitespace-pre-wrap break-words">{message}</span>
    </div>
  );
}

interface LevelFilterProps {
  level: string;
  selected: boolean;
  onClick: () => void;
  count: number;
}

function LevelFilter({ level, selected, onClick, count }: LevelFilterProps) {
  return (
    <Button
      variant={selected ? "secondary" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
    >
      <span className="capitalize">{level}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs ${
          selected ? "bg-background" : "bg-muted"
        }`}
      >
        {count}
      </span>
    </Button>
  );
}
