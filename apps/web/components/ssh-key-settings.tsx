"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSSHKeyStatus,
  generateSSHKeyPair,
  uploadSSHKey,
  deleteSSHKey,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Key,
  Copy,
  Check,
  Download,
  Upload,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface SSHKey {
  id: number;
  public_key: string;
  name: string | null;
  created_at: string;
}

interface GeneratedKey {
  publicKey: string;
  privateKey: string;
}

type UploadMode = "generate" | "upload" | null;

// Helper function
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ============================================================================
// SSHKeyListItem - Single key display with copy/delete actions
// ============================================================================
interface SSHKeyListItemProps {
  sshKey: SSHKey;
  copiedKeyId: number | null;
  onCopy: (key: string, keyId: number) => void;
  onDelete: (keyId: number) => void;
  className?: string;
}

function SSHKeyListItem({
  sshKey,
  copiedKeyId,
  onCopy,
  onDelete,
  className,
}: SSHKeyListItemProps) {
  const isCopied = copiedKeyId === sshKey.id;

  return (
    <div data-slot="ssh-key-item" className={cn("border p-3", className)}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {sshKey.name ? (
              <>
                <p className="text-sm font-medium">{sshKey.name}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCopy(sshKey.public_key, sshKey.id)}
                  className="h-6 px-2 rounded-none!"
                >
                  {isCopied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopy(sshKey.public_key, sshKey.id)}
                className="h-6 px-2 rounded-none!"
              >
                {isCopied ? (
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
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              {formatDate(sshKey.created_at)}
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(sshKey.id)}
          className="h-7 shrink-0"
        >
          <Trash2 className="size-3 mr-1" />
          Delete
        </Button>
      </div>
      <code className="block w-full text-xs bg-muted p-2 font-mono break-all">
        {sshKey.public_key}
      </code>
    </div>
  );
}

// ============================================================================
// SSHKeyList - List of all SSH keys
// ============================================================================
interface SSHKeyListProps {
  keys: SSHKey[];
  copiedKeyId: number | null;
  onCopy: (key: string, keyId: number) => void;
  onDelete: (keyId: number) => void;
  error?: string | null;
  className?: string;
}

function SSHKeyList({
  keys,
  copiedKeyId,
  onCopy,
  onDelete,
  error,
  className,
}: SSHKeyListProps) {
  if (keys.length === 0) return null;

  return (
    <Card data-slot="ssh-key-list" className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="size-5" />
          SSH Keys ({keys.length})
        </CardTitle>
        <CardDescription>
          Your SSH keys are configured and ready for GPU pod access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-3">
          {keys.map((key) => (
            <SSHKeyListItem
              key={key.id}
              sshKey={key}
              copiedKeyId={copiedKeyId}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AddKeyOptions - Generate/Upload choice buttons
// ============================================================================
interface AddKeyOptionsProps {
  onGenerate: () => void;
  onUpload: () => void;
  isGenerating: boolean;
  hasExistingKeys: boolean;
  className?: string;
}

function AddKeyOptions({
  onGenerate,
  onUpload,
  isGenerating,
  hasExistingKeys,
  className,
}: AddKeyOptionsProps) {
  return (
    <Card data-slot="add-key-options" className={className}>
      <CardHeader>
        <CardTitle
          className={cn(
            "flex items-center gap-2",
            hasExistingKeys && "text-base"
          )}
        >
          {!hasExistingKeys && <Key className="size-5" />}
          {hasExistingKeys ? "Add Another Key" : "SSH Key"}
        </CardTitle>
        <CardDescription className={cn(hasExistingKeys && "text-xs mt-1")}>
          {hasExistingKeys
            ? "Create additional SSH keys for different purposes"
            : "Configure an SSH key for secure access to GPU pods."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            <Plus className="size-5" />
            <span className="font-medium">
              {isGenerating ? "Generating..." : "Generate New Key"}
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Create a new Ed25519 key pair
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={onUpload}
            disabled={isGenerating}
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
  );
}

// ============================================================================
// GenerateKeyForm - Form for saving generated private key
// ============================================================================
interface GenerateKeyFormProps {
  generatedKey: GeneratedKey;
  keyName: string;
  onKeyNameChange: (name: string) => void;
  privateKeySaved: boolean;
  onPrivateKeySavedChange: (saved: boolean) => void;
  onCopyPrivateKey: () => void;
  onDownloadPrivateKey: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  copied: boolean;
  isUploading: boolean;
  error?: string | null;
  className?: string;
}

function GenerateKeyForm({
  generatedKey,
  keyName,
  onKeyNameChange,
  privateKeySaved,
  onPrivateKeySavedChange,
  onCopyPrivateKey,
  onDownloadPrivateKey,
  onConfirm,
  onCancel,
  copied,
  isUploading,
  error,
  className,
}: GenerateKeyFormProps) {
  return (
    <Card data-slot="generate-key-form" className={className}>
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
          <Label htmlFor="key-name">Key Name (Optional)</Label>
          <Input
            id="key-name"
            placeholder="e.g., My Laptop, Production Key"
            value={keyName}
            onChange={(e) => onKeyNameChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Give this key a descriptive name to help identify it later
          </p>
        </div>

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
                onClick={onCopyPrivateKey}
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
                onClick={onDownloadPrivateKey}
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
            onChange={(e) => onPrivateKeySavedChange(e.target.checked)}
            className="rounded border-input"
          />
          <Label htmlFor="saved-key" className="text-sm cursor-pointer">
            I have saved my private key
          </Label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!privateKeySaved || isUploading}
          >
            {isUploading ? "Saving..." : "Confirm & Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// UploadKeyForm - Form for manual key upload
// ============================================================================
interface UploadKeyFormProps {
  keyName: string;
  onKeyNameChange: (name: string) => void;
  publicKey: string;
  onPublicKeyChange: (key: string) => void;
  privateKey: string;
  onPrivateKeyChange: (key: string) => void;
  onUpload: () => void;
  onCancel: () => void;
  isUploading: boolean;
  error?: string | null;
  className?: string;
}

function UploadKeyForm({
  keyName,
  onKeyNameChange,
  publicKey,
  onPublicKeyChange,
  privateKey,
  onPrivateKeyChange,
  onUpload,
  onCancel,
  isUploading,
  error,
  className,
}: UploadKeyFormProps) {
  return (
    <Card data-slot="upload-key-form" className={className}>
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
          <Label htmlFor="key-name-upload">Key Name (Optional)</Label>
          <Input
            id="key-name-upload"
            placeholder="e.g., My Laptop, Production Key"
            value={keyName}
            onChange={(e) => onKeyNameChange(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Give this key a descriptive name to help identify it later
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="public-key">Public Key</Label>
          <Textarea
            id="public-key"
            placeholder="ssh-ed25519 AAAAC3..."
            value={publicKey}
            onChange={(e) => onPublicKeyChange(e.target.value)}
            className="font-mono text-xs h-20 resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="private-key">Private Key</Label>
          <Textarea
            id="private-key"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            value={privateKey}
            onChange={(e) => onPrivateKeyChange(e.target.value)}
            className="font-mono text-xs h-40 resize-none"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onUpload}
            disabled={!publicKey.trim() || !privateKey.trim() || isUploading}
          >
            {isUploading ? "Uploading..." : "Upload Key"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DeleteKeyDialog - Confirmation dialog for key deletion
// ============================================================================
interface DeleteKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteKeyDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete SSH Key</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this SSH key? This action cannot be
            undone. The key will be removed from Prime Intellect and AWS Secrets
            Manager.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// LoadingSkeleton - Loading state
// ============================================================================
function LoadingSkeleton() {
  return (
    <Card data-slot="ssh-key-loading">
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

// ============================================================================
// ErrorState - Error display with retry
// ============================================================================
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <Card data-slot="ssh-key-error">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="size-5 text-destructive" />
          Error
        </CardTitle>
        <CardDescription className="text-destructive">{error}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onRetry}>Retry</Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SSHKeySettings - Main composed component
// ============================================================================
export function SSHKeySettings() {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [privateKeySaved, setPrivateKeySaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for manual upload
  const [manualPublicKey, setManualPublicKey] = useState("");
  const [manualPrivateKey, setManualPrivateKey] = useState("");
  const [keyName, setKeyName] = useState("");

  async function fetchKeys() {
    setIsLoading(true);
    setError(null);

    const result = await getSSHKeyStatus();

    if (!result.success) {
      setIsLoading(false);
      setError(result.error || "Failed to check SSH key status");
      return;
    }

    if (result.data?.keys && result.data.keys.length > 0) {
      setKeys(result.data.keys);
    } else {
      setKeys([]);
    }
    setIsLoading(false);
  }

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    const result = await generateSSHKeyPair();

    setIsGenerating(false);

    if (!result.success || !result.data) {
      setError(result.error || "Failed to generate SSH key pair");
      return;
    }

    setGeneratedKey(result.data);
    setUploadMode("generate");
  }, []);

  const handleConfirmSave = useCallback(async () => {
    if (!generatedKey) return;

    setIsUploading(true);
    setError(null);

    const result = await uploadSSHKey(
      generatedKey.publicKey,
      generatedKey.privateKey,
      keyName.trim() || undefined
    );

    setIsUploading(false);

    if (!result.success) {
      setError(result.error || "Failed to upload SSH key");
      return;
    }

    // Reset form state and refresh
    setUploadMode(null);
    setGeneratedKey(null);
    setPrivateKeySaved(false);
    setManualPublicKey("");
    setManualPrivateKey("");
    setKeyName("");
    setError(null);
    await fetchKeys();
  }, [generatedKey, keyName]);

  const handleUpload = useCallback(async () => {
    if (!manualPublicKey.trim() || !manualPrivateKey.trim()) {
      setError("Both public and private keys are required");
      return;
    }

    setIsUploading(true);
    setError(null);

    const result = await uploadSSHKey(
      manualPublicKey.trim(),
      manualPrivateKey.trim(),
      keyName.trim() || undefined
    );

    setIsUploading(false);

    if (!result.success) {
      setError(result.error || "Failed to upload SSH key");
      return;
    }

    // Reset form state and refresh
    setUploadMode(null);
    setGeneratedKey(null);
    setPrivateKeySaved(false);
    setManualPublicKey("");
    setManualPrivateKey("");
    setKeyName("");
    setError(null);
    await fetchKeys();
  }, [manualPublicKey, manualPrivateKey, keyName]);

  const handleDeleteClick = useCallback((keyId: number) => {
    setKeyToDelete(keyId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!keyToDelete) return;

    setIsDeleting(true);
    setError(null);

    const result = await deleteSSHKey(keyToDelete);

    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setKeyToDelete(null);

    if (!result.success) {
      const errorMessage =
        typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error);
      setError(errorMessage || "Failed to delete SSH key");
      return;
    }

    await fetchKeys();
  }, [keyToDelete]);

  const handleCopyPrivateKey = useCallback(() => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey.privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedKey]);

  const handleDownloadPrivateKey = useCallback(() => {
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
  }, [generatedKey]);

  const handleCopyPublicKey = useCallback((key: string, keyId: number) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }, []);

  const resetFormState = useCallback(() => {
    setUploadMode(null);
    setGeneratedKey(null);
    setPrivateKeySaved(false);
    setManualPublicKey("");
    setManualPrivateKey("");
    setKeyName("");
    setError(null);
  }, []);

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state (only if no keys loaded)
  if (error && keys.length === 0 && !uploadMode && !generatedKey) {
    return <ErrorState error={error} onRetry={fetchKeys} />;
  }

  const hasExistingKeys = keys.length > 0;

  return (
    <div data-slot="ssh-key-settings" className="space-y-6">
      {/* Delete confirmation dialog */}
      <DeleteKeyDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setKeyToDelete(null);
        }}
        isDeleting={isDeleting}
      />

      {/* Always show key list if keys exist */}
      <SSHKeyList
        keys={keys}
        copiedKeyId={copiedKeyId}
        onCopy={handleCopyPublicKey}
        onDelete={handleDeleteClick}
        error={hasExistingKeys ? error : null}
      />

      {/* Show generated key form */}
      {generatedKey && uploadMode === "generate" && (
        <GenerateKeyForm
          generatedKey={generatedKey}
          keyName={keyName}
          onKeyNameChange={setKeyName}
          privateKeySaved={privateKeySaved}
          onPrivateKeySavedChange={setPrivateKeySaved}
          onCopyPrivateKey={handleCopyPrivateKey}
          onDownloadPrivateKey={handleDownloadPrivateKey}
          onConfirm={handleConfirmSave}
          onCancel={resetFormState}
          copied={copied}
          isUploading={isUploading}
          error={error}
        />
      )}

      {/* Show upload form */}
      {uploadMode === "upload" && (
        <UploadKeyForm
          keyName={keyName}
          onKeyNameChange={setKeyName}
          publicKey={manualPublicKey}
          onPublicKeyChange={setManualPublicKey}
          privateKey={manualPrivateKey}
          onPrivateKeyChange={setManualPrivateKey}
          onUpload={handleUpload}
          onCancel={resetFormState}
          isUploading={isUploading}
          error={error}
        />
      )}

      {/* Show add options when not in a form mode */}
      {!uploadMode && !generatedKey && (
        <AddKeyOptions
          onGenerate={handleGenerate}
          onUpload={() => setUploadMode("upload")}
          isGenerating={isGenerating}
          hasExistingKeys={hasExistingKeys}
        />
      )}
    </div>
  );
}
