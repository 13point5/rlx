"use client";

import { useCallback, useEffect, useState } from "react";
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

export function WandbSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [awsRegion, setAwsRegion] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getWandbKeyStatus();

    if (!result.success) {
      setIsLoading(false);
      setError(result.error || "Failed to load W&B status");
      return;
    }

    setConfigured(result.data?.configured ?? false);
    setAwsRegion(result.data?.aws_region ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await setWandbApiKey(apiKey);

    setIsSaving(false);

    if (!result.success) {
      setError(result.error || "Failed to save API key");
      return;
    }

    setApiKey("");
    await loadStatus();
  }, [apiKey, loadStatus]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    const result = await deleteWandbApiKey();

    setIsDeleting(false);
    setDeleteDialogOpen(false);

    if (!result.success) {
      setError(result.error || "Failed to delete API key");
      return;
    }

    await loadStatus();
  }, [loadStatus]);

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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            Status:{" "}
            <span className={configured ? "text-foreground font-medium" : "text-muted-foreground"}>
              {configured ? "Configured" : "Not configured"}
            </span>
          </p>
          {awsRegion && <p className="text-xs text-muted-foreground">AWS region: {awsRegion}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="wandb-api-key">W&B API Key</Label>
          <Input
            id="wandb-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={configured ? "Stored in AWS Secrets Manager" : "Paste your W&B API key"}
            disabled={configured || isSaving || isDeleting}
          />
          {configured && (
            <p className="text-xs text-muted-foreground">Delete the key to set a new one.</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="size-4" />
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={configured || isSaving || !apiKey.trim()}>
            {isSaving ? "Saving..." : "Save Key"}
          </Button>
          {configured && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={isDeleting}>
              <Trash2 className="size-4 mr-1" />
              Delete Key
            </Button>
          )}
          {error && (
            <Button variant="outline" onClick={loadStatus} disabled={isSaving || isDeleting}>
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
