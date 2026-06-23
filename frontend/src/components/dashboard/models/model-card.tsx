"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play,
  X,
  Loader2,
  Upload,
  Cpu,
  ChevronRight,
  CheckCircle2,
  Info,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelStatusBadge } from "@/components/models/model-status-badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { useStartTraining } from "@/lib/hooks/use-model-actions";
import { useDeleteModel } from "@/lib/hooks/use-model-actions";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import { useDatasets } from "@/lib/hooks/use-datasets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ModelSummary } from "@/types/api";
import { Slider } from "@/components/ui/slider";
import type { TrainingParams } from "@/types/api";

const BASE_MODEL_INFO: Record<
  string,
  { params: string; useCase: string; speed: string }
> = {
  tinyllama: {
    params: "1.1B",
    speed: "Fast · CPU-friendly",
    useCase:
      "Great for Q&A, classification, and short-form generation on low-resource hardware.",
  },
  qwen: {
    params: "0.5B",
    speed: "Very fast · minimal VRAM",
    useCase:
      "Ultra-compact model. Good for multilingual tasks and rapid prototyping.",
  },
};

function InlineProgress({
  logs,
  isDone,
  isTraining,
}: {
  logs: string[];
  isDone: boolean;
  isTraining: boolean;
}) {
  let progress: number | null = null;
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) {
      progress = Math.min(100, parseFloat(m[1]));
      break;
    }
    const s = logs[i].match(/step\s+(\d+)\s*\/\s*(\d+)/i);
    if (s) {
      progress = Math.min(100, Math.round((Number(s[1]) / Number(s[2])) * 100));
      break;
    }
  }
  const pct = isDone ? 100 : (progress ?? (logs.length > 0 ? 15 : null));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {isDone ? "Training done" : "Training…"}
        </span>
        {pct !== null && (
          <span className="text-[11px] font-medium">{pct}%</span>
        )}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        {pct !== null ? (
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isDone ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}

export function ModelCard({ model }: { model: ModelSummary }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showBaseInfo, setShowBaseInfo] = useState(false);
  const [showTrainParams, setShowTrainParams] = useState(false);
  const [trainParams, setTrainParams] = useState<TrainingParams>({
    numEpochs: 3,
    learningRate: 2e-4,
    batchSize: 4,
    warmupSteps: 10,
    maxSeqLength: 512,
  });
  const startTraining = useStartTraining();
  const deleteModel = useDeleteModel();
  const { data: datasets } = useDatasets();

  const isTraining = model.status === "TRAINING";
  const canTrain = model.status === "PENDING" || model.status === "FAILED";
  const isUserOwned = !model.is_base_model;
  const isUploaded = model.is_uploaded;
  const isCompleted = model.status === "COMPLETED" || model.status === "READY";

  const dataset = datasets?.find((d) => d.id === model.dataset_id);
  const baseInfo = BASE_MODEL_INFO[model.base_model_key ?? ""];

  // SSE logs — only active when training
  const { logs, isDone } = useTrainingLogs(
    isTraining ? model.id : null,
    isTraining,
  );

  const handleStartTraining = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataset) {
      toast.error("Dataset not found for this model.");
      return;
    }
    startTraining.mutate(
      {
        modelId: model.id,
        datasetPath: dataset.file_path,
        trainingParams: trainParams,
      },
      {
        onSuccess: () => toast.success("Training started."),
        onError: (err) => toast.error(err.message),
      },
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
        onKeyDown={(e) =>
          e.key === "Enter" && router.push(`/dashboard/models/${model.id}`)
        }
        className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {/* Delete — user-owned models only */}
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
            <p className="truncate text-sm font-semibold">
              {model.display_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {model.base_model_key}
              {model.is_base_model
                ? " · System"
                : isUploaded
                  ? " · Uploaded"
                  : " · Fine-tuned"}
            </p>
          </div>
        </div>

        {/* Base model details (system models) */}
        {model.is_base_model && baseInfo && (
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium">
                {baseInfo.params} params · {baseInfo.speed}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBaseInfo((v) => !v);
                }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3 w-3" />
              </button>
            </div>
            {showBaseInfo && (
              <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                {baseInfo.useCase}
              </p>
            )}
          </div>
        )}

        {/* Status row */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <ModelStatusDot status={isDone ? "COMPLETED" : model.status} />
            <ModelStatusBadge status={isDone ? "COMPLETED" : model.status} />
          </div>
          {dataset && !isTraining && (
            <p className="text-xs text-muted-foreground">
              Dataset: {dataset.filename}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Added {new Date(model.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Inline training progress */}
        {(isTraining || (isDone && logs.length > 0)) && (
          <InlineProgress logs={logs} isDone={isDone} isTraining={isTraining} />
        )}

        {/* Training done banner */}
        {isDone && (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Model training done
            </span>
          </div>
        )}

        {/* Actions */}
        <div
          className="flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {canTrain && (
            <>
              <button
                type="button"
                onClick={() => setShowTrainParams((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                Training parameters
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showTrainParams && "rotate-180",
                  )}
                />
              </button>

              {showTrainParams && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2.5">
                  {(
                    [
                      {
                        key: "numEpochs",
                        label: "Epochs",
                        min: 1,
                        max: 20,
                        step: 1,
                      },
                      {
                        key: "batchSize",
                        label: "Batch size",
                        min: 1,
                        max: 32,
                        step: 1,
                      },
                      {
                        key: "warmupSteps",
                        label: "Warmup steps",
                        min: 0,
                        max: 200,
                        step: 5,
                      },
                      {
                        key: "maxSeqLength",
                        label: "Max seq length",
                        min: 64,
                        max: 2048,
                        step: 64,
                      },
                    ] as const
                  ).map(({ key, label, min, max, step }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{trainParams[key]}</span>
                      </div>
                      <Slider
                        min={min}
                        max={max}
                        step={step}
                        value={[trainParams[key] as number]}
                        onValueChange={([v]) =>
                          setTrainParams((p) => ({ ...p, [key]: v }))
                        }
                      />
                    </div>
                  ))}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Learning rate
                      </span>
                      <span className="font-medium">
                        {(trainParams.learningRate ?? 2e-4).toExponential(0)}
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={20}
                      step={1}
                      value={[
                        Math.round((trainParams.learningRate ?? 2e-4) / 1e-5),
                      ]}
                      onValueChange={([v]) =>
                        setTrainParams((p) => ({
                          ...p,
                          learningRate: v * 1e-5,
                        }))
                      }
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Range: 1×10⁻⁵ → 2×10⁻⁴
                    </span>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                className="h-7 text-xs self-start"
                onClick={handleStartTraining}
                disabled={startTraining.isPending || !dataset}
              >
                <Play className="h-3 w-3" />
                {startTraining.isPending ? "Starting…" : "Train"}
              </Button>
            </>
          )}
          <div className="flex items-center gap-2">
            {isTraining && !isDone && (
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
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent
          className="max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Remove model?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {model.display_name}
            </span>{" "}
            will be permanently removed. This cannot be undone.
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
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing…
                </>
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
