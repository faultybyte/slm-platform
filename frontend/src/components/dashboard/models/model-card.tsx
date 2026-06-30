"use client";

import { useEffect, useState } from "react";
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
  RotateCcw,
  Database,
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
  { params: string; label: string; speed: string }
> = {
  "llama3.2-1b": {
    params: "1B",
    speed: "Very fast · minimal VRAM",
    label: "Good for lightweight general-purpose chat and low-VRAM inference.",
  },
  "deepseek-r1-distill-qwen-1.5b": {
    params: "1.5B",
    speed: "Fast · distilled quality",
    label: "Well suited for quick reasoning and concise answer generation.",
  },
  "gemma3-1b": {
    params: "1B",
    speed: "Fast · efficient",
    label: "Good for broad multi-domain tasks with efficient inference.",
  },
  "qwen2.5-3b": {
    params: "2.5B",
    speed: "Balanced · strong instruction following",
    label: "Great for instruction-following and conversational workloads.",
  },
};

function InlineProgress({
  logs,
  isDone,
}: {
  logs: string[];
  isDone: boolean;
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

/** Shared training-params sliders panel */
function TrainingParamsPanel({
  params,
  onChange,
}: {
  params: TrainingParams;
  onChange: (p: TrainingParams) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2.5">
      {(
        [
          { key: "numEpochs",    label: "Epochs",         min: 1,  max: 20,   step: 1  },
          { key: "batchSize",    label: "Batch size",     min: 1,  max: 32,   step: 1  },
          { key: "warmupSteps",  label: "Warmup steps",   min: 0,  max: 200,  step: 5  },
          { key: "maxSeqLength", label: "Max seq length", min: 64, max: 2048, step: 64 },
        ] as const
      ).map(({ key, label, min, max, step }) => (
        <div key={key} className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{params[key]}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[params[key] as number]}
            onValueChange={([v]) => onChange({ ...params, [key]: v })}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">Learning rate</span>
          <span className="font-medium">
            {(params.learningRate ?? 2e-4).toExponential(0)}
          </span>
        </div>
        <Slider
          min={1}
          max={20}
          step={1}
          value={[Math.round((params.learningRate ?? 2e-4) / 1e-5)]}
          onValueChange={([v]) =>
            onChange({ ...params, learningRate: v * 1e-5 })
          }
        />
        <span className="text-[10px] text-muted-foreground">
          Range: 1×10⁻⁵ → 2×10⁻⁴
        </span>
      </div>
    </div>
  );
}

/** Dataset dropdown for uploaded models that need to pick before training */
function DatasetSelector({
  datasets,
  selectedId,
  onSelect,
}: {
  datasets: { id: number; filename: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Database className="h-3 w-3" />
        Select dataset
      </div>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="" disabled>
          — choose a dataset —
        </option>
        {datasets.map((d) => (
          <option key={d.id} value={d.id}>
            {d.filename}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ModelCard({ model }: { model: ModelSummary }) {
  const router = useRouter();

  const [confirmDelete, setConfirmDelete]       = useState(false);
  const [showBaseInfo, setShowBaseInfo]         = useState(false);
  const [showTrainParams, setShowTrainParams]   = useState(false);
  const [showRetrainPanel, setShowRetrainPanel] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);

  const [trainParams, setTrainParams] = useState<TrainingParams>({
    numEpochs: 3,
    learningRate: 2e-4,
    batchSize: 4,
    warmupSteps: 10,
    maxSeqLength: 512,
  });

  const [isStarting, setIsStarting] = useState(false);

  const startTraining = useStartTraining();
  const deleteModel   = useDeleteModel();
  const { data: datasets } = useDatasets();

  const isTraining  = model.status === "TRAINING";
  const isUserOwned = !model.is_base_model;
  const isUploaded  = !!model.is_uploaded;
  const isCompleted = model.status === "COMPLETED" || model.status === "READY";
  const trainingActive = isTraining || isStarting;

  /** Retrain is available for ANY user-owned model (fine-tuned or uploaded) once training has run */
  const canTrain    = !trainingActive && (model.status === "PENDING" || model.status === "FAILED");
  const canRetrain  = isCompleted && isUserOwned && !trainingActive;

  const dataset = datasets?.find((d) => d.id === model.dataset_id);
  const baseInfo = BASE_MODEL_INFO[model.base_model_key ?? ""];

  // SSE logs — active while training or while we've just initiated start
  const { logs, isDone } = useTrainingLogs(
    trainingActive ? model.id : null,
    trainingActive,
  );

  useEffect(() => {
    if (isTraining || isDone || model.status === "FAILED") {
      window.setTimeout(() => setIsStarting(false), 0);
    }
  }, [isTraining, isDone, model.status]);

  /** Resolve which dataset to use when triggering training */
  const getEffectiveDataset = () => {
    if (isUploaded) {
      return datasets?.find((d) => d.id === selectedDatasetId) ?? null;
    }
    return dataset ?? null;
  };

  const handleStartTraining = (e: React.MouseEvent) => {
    e.stopPropagation();
    const eff = getEffectiveDataset();
    if (!eff) {
      toast.error(
        isUploaded
          ? "Please select a dataset before training."
          : "Dataset not found for this model.",
      );
      return;
    }
    // Prevent accidental double clicks by using local starting flag
    if (isStarting || startTraining.isPending) return;
    setIsStarting(true);
    startTraining.mutate(
      { modelId: model.id, datasetPath: eff.file_path, trainingParams: trainParams },
      {
        onSuccess: () => {
          toast.success("Training started.");
        },
        onError: (err) => {
          toast.error(err.message);
          setIsStarting(false);
        },
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

        {/* ── Header ── */}
        <div className="flex items-start gap-2 pr-6">
          <div
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              isUploaded ? "bg-violet-100 dark:bg-violet-950" : "bg-secondary",
            )}
          >
            {isUploaded ? (
              <Upload className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            ) : (
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{model.display_name}</p>
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

        {/* Base model info chip */}
        {model.is_base_model && baseInfo && (
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium">
                {baseInfo.params} params · {baseInfo.speed}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              {baseInfo.label}
            </p>
          </div>
        )}

        {/* ── Status row ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <ModelStatusDot status={isDone ? "COMPLETED" : model.status} />
            <ModelStatusBadge status={isDone ? "COMPLETED" : model.status} />
          </div>
          {dataset && !trainingActive && (
            <p className="text-xs text-muted-foreground">
              Dataset: {dataset.filename}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Added {new Date(model.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* ── Inline training progress ── */}
        {(trainingActive || (isDone && logs.length > 0)) && (
          <InlineProgress logs={logs} isDone={isDone} />
        )}

        {/* Training-done banner */}
        {isDone && (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Model training done
            </span>
          </div>
        )}

        {/* ══════════════════════════════════════════
            Actions area — stop propagation so clicks
            don't navigate to the detail page.
        ══════════════════════════════════════════ */}
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>

          {/* ── TRAIN (PENDING / FAILED) ── */}
          {canTrain && (
            <>
              {/* Dataset picker — only for uploaded models */}
              {isUploaded && datasets && datasets.length > 0 && (
                <DatasetSelector
                  datasets={datasets}
                  selectedId={selectedDatasetId}
                  onSelect={setSelectedDatasetId}
                />
              )}
              {isUploaded && (!datasets || datasets.length === 0) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  No datasets found. Upload a dataset first.
                </p>
              )}

              {/* Training-params toggle */}
              <button
                type="button"
                onClick={() => setShowTrainParams((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
                <TrainingParamsPanel
                  params={trainParams}
                  onChange={setTrainParams}
                />
              )}

              <Button
                size="sm"
                className="h-7 self-start text-xs"
                onClick={handleStartTraining}
                disabled={
                  startTraining.isPending ||
                  trainingActive ||
                  (isUploaded ? !selectedDatasetId : !dataset)
                }
              >
                <Play className="h-3 w-3" />
                {startTraining.isPending ? "Starting…" : "Start training"}
              </Button>
            </>
          )}

          {/* ── RETRAIN (COMPLETED / READY — both fine-tuned AND uploaded) ── */}
          {canRetrain && (
            <div className="flex flex-col gap-2">
              {/* Divider only when not freshly trained (isDone banner already visible) */}
              {!isDone && (
                <div className="h-px w-full bg-border" />
              )}

              <button
                type="button"
                onClick={() => setShowRetrainPanel((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Retrain model
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showRetrainPanel && "rotate-180",
                  )}
                />
              </button>

              {showRetrainPanel && (
                <div className="flex flex-col gap-2">
                  {/* Dataset picker — uploaded models need to pick; fine-tuned can re-use existing */}
                  {isUploaded && datasets && datasets.length > 0 && (
                    <DatasetSelector
                      datasets={datasets}
                      selectedId={selectedDatasetId}
                      onSelect={setSelectedDatasetId}
                    />
                  )}
                  {isUploaded && (!datasets || datasets.length === 0) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      No datasets found. Upload a dataset first.
                    </p>
                  )}
                  {!isUploaded && dataset && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium">Dataset:</span> {dataset.filename}
                    </p>
                  )}

                  {/* Params */}
                  <button
                    type="button"
                    onClick={() => setShowTrainParams((v) => !v)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
                    <TrainingParamsPanel
                      params={trainParams}
                      onChange={setTrainParams}
                    />
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 self-start text-xs"
                    onClick={handleStartTraining}
                    disabled={
                      startTraining.isPending ||
                      trainingActive ||
                      (isUploaded ? !selectedDatasetId : !dataset)
                    }
                  >
                    <RotateCcw className="h-3 w-3" />
                    {startTraining.isPending ? "Starting…" : "Retrain"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Footer row ── */}
          <div className="flex items-center gap-2">
            {trainingActive && !isDone && (
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

      {/* ── Confirm delete dialog ── */}
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
