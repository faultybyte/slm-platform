"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, X, Loader2, Upload, Cpu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelStatusBadge } from "@/components/models/model-status-badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { useStartTraining } from "@/lib/hooks/use-model-actions";
import { useDeleteModel } from "@/lib/hooks/use-model-actions";
import { useDatasets } from "@/lib/hooks/use-datasets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ModelSummary } from "@/types/api";

export function ModelCard({ model }: { model: ModelSummary }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const startTraining = useStartTraining();
  const deleteModel = useDeleteModel();
  const { data: datasets } = useDatasets();

  const isTraining = model.status === "TRAINING";
  const canTrain = model.status === "PENDING" || model.status === "FAILED";
  const isUserOwned = !model.is_base_model;
  const isUploaded = model.is_uploaded;

  const dataset = datasets?.find((d) => d.id === model.dataset_id);

  const handleStartTraining = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataset) {
      toast.error("Dataset not found for this model.");
      return;
    }
    startTraining.mutate(
      { modelId: model.id, datasetPath: dataset.file_path, baseModelKey: model.base_model_key },
      {
        onSuccess: () => toast.success("Training started."),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteModel.mutate(model.id, {
      onSuccess: () => {
        toast.success(`"${model.display_name}" removed.`);
        setConfirmDelete(false);
      },
      onError: (err) => {
        toast.error(err.message);
        setConfirmDelete(false);
      },
    });
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/dashboard/models/${model.id}`)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/dashboard/models/${model.id}`)}
        className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {/* Delete button — only for user-owned models */}
        {isUserOwned && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
            aria-label={`Remove ${model.display_name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-start gap-2 pr-6">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
            {isUploaded ? (
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{model.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {model.base_model_key}
              {model.is_base_model ? " · System" : isUploaded ? " · Uploaded" : " · Fine-tuned"}
            </p>
          </div>
        </div>

        {/* Status + dataset */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <ModelStatusDot status={model.status} />
            <ModelStatusBadge status={model.status} />
          </div>
          {dataset && (
            <p className="text-xs text-muted-foreground">
              Dataset: {dataset.filename}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Added {new Date(model.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canTrain && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleStartTraining}
              disabled={startTraining.isPending}
            >
              <Play className="h-3 w-3" />
              {startTraining.isPending ? "Starting…" : "Train"}
            </Button>
          )}
          {isTraining && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Training…
            </span>
          )}
          <div className="ml-auto flex items-center text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            View details <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Remove model?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{model.display_name}</span> will be
            permanently removed. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteModel.isPending}
            >
              {deleteModel.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing…</>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
