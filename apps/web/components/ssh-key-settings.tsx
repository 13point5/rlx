"use client";

import { useEffect, useState } from "react";
import {
  getSSHKeyStatus,
  generateSSHKeyPair,
  uploadSSHKey,
  deleteSSHKey,
  listPrimeSSHKeys,
  deletePrimeSSHKey,
} from "@/app/actions/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Key,
  Copy,
  Check,
  Download,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

type ConnectionState =
  | "loading"
  | "disconnected"
  | "connected"
  | "generating"
  | "uploading"
  | "error";

type UploadMode = "generate" | "upload" | null;

interface GeneratedKey {
  publicKey: string;
  privateKey: string;
}

export function SSHKeySettings() {
  const [state, setState] = useState<ConnectionState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [privateKeySaved, setPrivateKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicKeyCopied, setPublicKeyCopied] = useState(false);
  
  // Orphaned keys management
  const [showOrphanedKeys, setShowOrphanedKeys] = useState(false);
  const [orphanedKeys, setOrphanedKeys] = useState<Array<{
    id: string;
    publicKey: string;
    name?: string;
    createdAt: string;
  }>>([]);
  const [loadingOrphanedKeys, setLoadingOrphanedKeys] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  // Form state for manual upload
  const [manualPublicKey, setManualPublicKey] = useState("");
  const [manualPrivateKey, setManualPrivateKey] = useState("");

  useEffect(() => {
    checkKeyStatus();
  }, []);

  async function checkKeyStatus() {
    setState("loading");
    setError(null);

    const result = await getSSHKeyStatus();

    if (!result.success) {
      setState("error");
      setError(result.error || "Failed to check SSH key status");
      return;
    }

    if (result.data?.configured) {
      setState("connected");
      setPublicKey(result.data.public_key || null);
      setCreatedAt(result.data.created_at || null);
    } else {
      setState("disconnected");
    }
  }

  async function handleGenerate() {
    setState("generating");
    setError(null);

    const result = await generateSSHKeyPair();

    if (!result.success || !result.data) {
      setState("disconnected");
      setError(result.error || "Failed to generate SSH key pair");
      return;
    }

    setGeneratedKey(result.data);
    setUploadMode("generate");
    setState("disconnected");
  }

  async function handleConfirmSave() {
    if (!generatedKey) return;

    setState("uploading");
    setError(null);

    const result = await uploadSSHKey(
      generatedKey.publicKey,
      generatedKey.privateKey
    );

    if (!result.success) {
      setState("disconnected");
      setError(result.error || "Failed to upload SSH key");
      return;
    }

    // Reset state and refresh
    setGeneratedKey(null);
    setPrivateKeySaved(false);
    setUploadMode(null);
    await checkKeyStatus();
  }

  async function handleUpload() {
    if (!manualPublicKey.trim() || !manualPrivateKey.trim()) {
      setError("Both public and private keys are required");
      return;
    }

    setState("uploading");
    setError(null);

    const result = await uploadSSHKey(
      manualPublicKey.trim(),
      manualPrivateKey.trim()
    );

    if (!result.success) {
      setState("disconnected");
      setError(result.error || "Failed to upload SSH key");
      return;
    }

    // Reset state and refresh
    setManualPublicKey("");
    setManualPrivateKey("");
    setUploadMode(null);
    await checkKeyStatus();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete your SSH key? This action cannot be undone."
    );

    if (!confirmed) return;

    setState("loading");
    setError(null);

    const result = await deleteSSHKey();

    if (!result.success) {
      setState("connected");
      setError(result.error || "Failed to delete SSH key");
      return;
    }

    setPublicKey(null);
    setCreatedAt(null);
    setState("disconnected");
  }

  function handleCopyPrivateKey() {
    if (!generatedKey) return;

    navigator.clipboard.writeText(generatedKey.privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadPrivateKey() {
    if (!generatedKey) return;

    const blob = new Blob([generatedKey.privateKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "id_ed25519";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleCancel() {
    setUploadMode(null);
    setGeneratedKey(null);
    setPrivateKeySaved(false);
    setManualPublicKey("");
    setManualPrivateKey("");
    setError(null);
  }

  async function handleLoadOrphanedKeys() {
    setLoadingOrphanedKeys(true);
    setError(null);
    
    const result = await listPrimeSSHKeys();
    
    if (!result.success) {
      setError(result.error || "Failed to load Prime Intellect keys");
      setLoadingOrphanedKeys(false);
      return;
    }
    
    setOrphanedKeys(result.keys || []);
    setLoadingOrphanedKeys(false);
    setShowOrphanedKeys(true);
  }

  async function handleDeleteOrphanedKey(keyId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this SSH key from Prime Intellect? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingKeyId(keyId);
    setError(null);

    const result = await deletePrimeSSHKey(keyId);

    if (!result.success) {
      setError(result.error || "Failed to delete SSH key");
      setDeletingKeyId(null);
      return;
    }

    // Remove from list
    setOrphanedKeys((keys) => keys.filter((k) => k.id !== keyId));
    setDeletingKeyId(null);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function handleCopyPublicKey() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    setPublicKeyCopied(true);
    setTimeout(() => setPublicKeyCopied(false), 2000);
  }

  // Loading state
  if (state === "loading") {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              Error
            </CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => checkKeyStatus()}>Retry</Button>
          </CardContent>
        </Card>

        {/* Orphaned Keys Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Prime Intellect Keys</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Manage SSH keys stored in Prime Intellect (for cleanup)
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (showOrphanedKeys) {
                    setShowOrphanedKeys(false);
                  } else {
                    handleLoadOrphanedKeys();
                  }
                }}
                disabled={loadingOrphanedKeys}
              >
                {loadingOrphanedKeys ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : showOrphanedKeys ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showOrphanedKeys && (
            <CardContent className="space-y-4">
              {orphanedKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No SSH keys found in Prime Intellect.
                </p>
              ) : (
                <div className="space-y-3">
                  {orphanedKeys.map((key) => (
                    <div
                      key={key.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          {key.name && (
                            <p className="text-sm font-medium">{key.name}</p>
                          )}
                          <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                            {key.publicKey.substring(0, 60)}...
                          </code>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(key.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {key.id}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteOrphanedKey(key.id)}
                          disabled={deletingKeyId === key.id}
                        >
                          {deletingKeyId === key.id ? (
                            <RefreshCw className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </>
    );
  }

  // Connected state
  if (state === "connected") {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="size-5" />
              SSH Key Configured
            </CardTitle>
            <CardDescription>
              Your SSH key is configured and ready for GPU pod access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {publicKey && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Public Key</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPublicKey}
                    className="h-7"
                  >
                    {publicKeyCopied ? (
                      <>
                        <Check className="size-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                  {publicKey}
                </code>
              </div>
            )}
            {createdAt && (
              <p className="text-sm text-muted-foreground">
                Created on {formatDate(createdAt)}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4 mr-2" />
              Delete Key
            </Button>
          </CardContent>
        </Card>

        {/* Orphaned Keys Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Prime Intellect Keys</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Manage SSH keys stored in Prime Intellect (for cleanup)
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (showOrphanedKeys) {
                    setShowOrphanedKeys(false);
                  } else {
                    handleLoadOrphanedKeys();
                  }
                }}
                disabled={loadingOrphanedKeys}
              >
                {loadingOrphanedKeys ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : showOrphanedKeys ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showOrphanedKeys && (
            <CardContent className="space-y-4">
              {orphanedKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No SSH keys found in Prime Intellect.
                </p>
              ) : (
                <div className="space-y-3">
                  {orphanedKeys.map((key) => (
                    <div
                      key={key.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          {key.name && (
                            <p className="text-sm font-medium">{key.name}</p>
                          )}
                          <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                            {key.publicKey.substring(0, 60)}...
                          </code>
                          <p className="text-xs text-muted-foreground">
                            Created: {formatDate(key.createdAt)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            ID: {key.id}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteOrphanedKey(key.id)}
                          disabled={deletingKeyId === key.id}
                        >
                          {deletingKeyId === key.id ? (
                            <RefreshCw className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </>
    );
  }

  // Disconnected state - showing private key from generation
  if (generatedKey && uploadMode === "generate") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Save Your Private Key
          </CardTitle>
          <CardDescription className="text-destructive font-medium">
            This is the only time you will see your private key. Save it now!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Private Key</Label>
            <div className="relative">
              <Textarea
                readOnly
                value={generatedKey.privateKey}
                className="font-mono text-xs h-40 resize-none"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrivateKey}
                  className="h-7"
                >
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPrivateKey}
                  className="h-7"
                >
                  <Download className="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Public Key</Label>
            <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
              {generatedKey.publicKey}
            </code>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="saved-key"
              checked={privateKeySaved}
              onChange={(e) => setPrivateKeySaved(e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="saved-key" className="text-sm cursor-pointer">
              I have saved my private key
            </Label>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={!privateKeySaved || state === "uploading"}
            >
              {state === "uploading" ? "Saving..." : "Confirm & Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Disconnected state - manual upload form
  if (uploadMode === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Upload SSH Key Pair
          </CardTitle>
          <CardDescription>
            Paste your existing SSH key pair below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="public-key">Public Key</Label>
            <Textarea
              id="public-key"
              placeholder="ssh-ed25519 AAAAC3..."
              value={manualPublicKey}
              onChange={(e) => setManualPublicKey(e.target.value)}
              className="font-mono text-xs h-20 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="private-key">Private Key</Label>
            <Textarea
              id="private-key"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              value={manualPrivateKey}
              onChange={(e) => setManualPrivateKey(e.target.value)}
              className="font-mono text-xs h-40 resize-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !manualPublicKey.trim() ||
                !manualPrivateKey.trim() ||
                state === "uploading"
              }
            >
              {state === "uploading" ? "Uploading..." : "Upload Key"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Disconnected state - choice screen
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="size-5" />
            SSH Key
          </CardTitle>
          <CardDescription>
            Configure an SSH key for secure access to GPU pods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive mb-4">{error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleGenerate}
              disabled={state === "generating"}
            >
              <Plus className="size-5" />
              <span className="font-medium">
                {state === "generating" ? "Generating..." : "Generate New Key"}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                Create a new Ed25519 key pair
              </span>
            </Button>

            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => setUploadMode("upload")}
            >
              <Upload className="size-5" />
              <span className="font-medium">Upload Existing Key</span>
              <span className="text-xs text-muted-foreground font-normal">
                Use your own SSH key pair
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orphaned Keys Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Prime Intellect Keys</CardTitle>
              <CardDescription className="text-xs mt-1">
                Manage SSH keys stored in Prime Intellect (for cleanup)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (showOrphanedKeys) {
                  setShowOrphanedKeys(false);
                } else {
                  handleLoadOrphanedKeys();
                }
              }}
              disabled={loadingOrphanedKeys}
            >
              {loadingOrphanedKeys ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : showOrphanedKeys ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showOrphanedKeys && (
          <CardContent className="space-y-4">
            {orphanedKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No SSH keys found in Prime Intellect.
              </p>
            ) : (
              <div className="space-y-3">
                {orphanedKeys.map((key) => (
                  <div
                    key={key.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {key.name && (
                          <p className="text-sm font-medium">{key.name}</p>
                        )}
                        <code className="block text-xs bg-muted p-2 rounded font-mono break-all">
                          {key.publicKey.substring(0, 60)}...
                        </code>
                        <p className="text-xs text-muted-foreground">
                          Created: {formatDate(key.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          ID: {key.id}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteOrphanedKey(key.id)}
                        disabled={deletingKeyId === key.id}
                      >
                        {deletingKeyId === key.id ? (
                          <RefreshCw className="size-3 animate-spin" />
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </>
  );
}
