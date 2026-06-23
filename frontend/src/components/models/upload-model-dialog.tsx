"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, HardDrive, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUploadModel } from "@/lib/hooks/use-model-actions";

const BASE_MODEL_KEYS = ["llama3.2", "qwen2.5-3b", "phi3", "mistral", "llama3", "gemma", "custom"];

const ACCEPTED_EXTENSIONS = [".gguf", ".bin", ".safetensors", ".pt", ".pth"];

export function UploadModelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [baseModelKey, setBaseModelKey] = useState("custom");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadModel();

  const validateAndSet = (f: File) => {
    setError(null);
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
      setFile(null);
      return;
    }
    setFile(f);
    // Auto-fill display name from filename if empty
    if (!displayName) {
      setDisplayName(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSubmit = () => {
    if (!file || !displayName.trim()) return;

    upload.mutate(
      { file, displayName: displayName.trim(), baseModelKey },
      {
        onSuccess: () => {
          toast.success(`Model "${displayName}" added.`);
          handleClose(false);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setFile(null);
      setDisplayName("");
      setBaseModelKey("custom");
      setError(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload your model</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Add a pre-trained or fine-tuned model file. Supported formats:{" "}
            <code className="rounded bg-muted px-1 text-xs">.gguf</code>{" "}
            <code className="rounded bg-muted px-1 text-xs">.safetensors</code>{" "}
            <code className="rounded bg-muted px-1 text-xs">.bin</code>
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-model-name">Display name</Label>
            <Input
              id="upload-model-name"
              placeholder="e.g. Cogniwide-GGUF-Q4"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-base-key">Architecture</Label>
            <select
              id="upload-base-key"
              value={baseModelKey}
              onChange={(e) => setBaseModelKey(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {BASE_MODEL_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-brand hover:bg-brand/5"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) validateAndSet(f);
            }}
          >
            {file ? (
              <>
                <HardDrive className="h-8 w-8 text-brand" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Drop model file here or click to browse
                </span>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) validateAndSet(f);
              e.target.value = "";
            }}
          />

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !displayName.trim() || upload.isPending}
          >
            {upload.isPending ? "Uploading…" : "Upload model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
