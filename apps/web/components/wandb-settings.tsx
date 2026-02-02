"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteWandbApiKey,
  getWandbKeyStatus,
  setWandbApiKey,
} from "@/app/actions/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Key, Trash2 } from "lucide-react";
import type { WandbKeyStatus } from "@/lib/types";

export function WandbSettings() {
  const [apiKey, setApiKey] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: status,
    isLoading,
    error: statusError,
    refetch,
  } = useQuery({
    queryKey: ["wandb-key-status"],
    queryFn: async () => {
      const result = await getWandbKeyStatus();
      if (!result.success) {
        throw new Error(result.error || "Failed to load W&B status");
      }
      if (result.data) {
        return result.data;
      }
      return { configured: false };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        throw new Error("API key is required");
      }
      const result = await setWandbApiKey(trimmed);
      if (!result.success) {
        throw new Error(result.error || "Failed to save API key");
      }
      return result.data ?? { configured: true };
    },
    onSuccess: (data) => {
      setApiKey("");
      setValidationError(null);
      queryClient.setQueryData<WandbKeyStatus | undefined>(
        ["wandb-key-status"],
        (current) => {
          if (current) {
            return { configured: data.configured };
          }
          if (status) {
            return { configured: data.configured };
          }
          return { configured: data.configured };
        }
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const result = await deleteWandbApiKey();
      if (!result.success) {
        throw new Error(result.error || "Failed to delete API key");
      }
      return result.data ?? { configured: false };
    },
    onSuccess: (data) => {
      setDeleteDialogOpen(false);
      queryClient.setQueryData<WandbKeyStatus | undefined>(
        ["wandb-key-status"],
        (current) => {
          if (current) {
            return { configured: data.configured };
          }
          if (status) {
            return { configured: data.configured };
          }
          return { configured: data.configured };
        }
      );
    },
  });

  if (isLoading) {
    return (
      <Card data-slot="wandb-settings-loading">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-56" />
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card data-slot="wandb-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Weights & Biases
          </CardTitle>
          <CardDescription>
            Store your W&B API key in AWS Secrets Manager for experiment logging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Unable to load W&B status right now.
          </p>
          {statusError && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" />
              {(statusError as Error).message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const configured = status.configured;

  let errorMessage: string | null = null;
  if (validationError) {
    errorMessage = validationError;
  } else if (saveMutation.error) {
    errorMessage = saveMutation.error.message;
  } else if (deleteMutation.error) {
    errorMessage = deleteMutation.error.message;
  } else if (statusError) {
    errorMessage = (statusError as Error).message;
  }

  return (
    <Card data-slot="wandb-settings">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete W&B API Key</DialogTitle>
            <DialogDescription>
              This will remove your W&B API key from AWS Secrets Manager. You can add a new
              key after deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardContent className="space-y-4">

        <div className="space-y-2">
          <Label htmlFor="wandb-api-key">W&B API Key</Label>
          {!configured && (
            <Input
              id="wandb-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setValidationError(null);
              }}
              placeholder="Paste your W&B API key"
              disabled={saveMutation.isPending || deleteMutation.isPending}
            />
          )}
        </div>

        {errorMessage && (
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="size-4" />
            {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!configured && (
            <Button
              onClick={() => {
                if (!apiKey.trim()) {
                  setValidationError("API key is required");
                  return;
                }
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending || !apiKey.trim()}
            >
              {saveMutation.isPending ? "Saving..." : "Save Key"}
            </Button>
          )}
          {configured && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-4 mr-1" />
              Delete Key
            </Button>
          )}
          {errorMessage && (
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={saveMutation.isPending || deleteMutation.isPending}
            >
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
