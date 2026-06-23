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

// Supported base models for LoRA fine-tuning
const SUPPORTED_BASE_MODELS = [
  { key: "llama3.2-1b",                    label: "Llama 3.2 1B" },
  { key: "qwen2.5-3b",                     label: "Qwen 2.5 3B" },
  { key: "deepseek-r1-distill-qwen-1.5b",  label: "DeepSeek-R1 1.5B" },
  { key: "gemma3-1b",                       label: "Gemma 3 1B" },
];

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
        <option value="" disabled>— choose a dataset —</option>
        {datasets.map((d) => (
          <option key={d.id} value={d.id}>{d.filename}</option>
        ))}
      </select>
    </div>
  );
}

function BaseModelSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Cpu className="h-3 w-3" />
        Base model for LoRA training
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {SUPPORTED_BASE_MODELS.map((m) => (
          <option key={m.key} value={m.key}>{m.label}</option>
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
  // Base model used for LoRA when fine-tuning an uploaded GGUF model
  const [selectedBaseModel, setSelectedBaseModel] = useState("llama3.2-1b");

  const [trainParams, setTrainParams] = useState<TrainingParams>({
    numEpochs: 3,
    learningRate: 2e-4,
    batchSize: 1,
    warmupSteps: 10,
    maxSeqLength: 512,
  });

  const startTraining = useStartTraining();
  const deleteModel   = useDeleteModel();
  const { data: datasets } = useDatasets();

  const isTraining  = model.status === "TRAINING";
  const isUploaded  = !!model.is_uploaded;
  const isUserOwned = !model.is_base_model;
  const isCompleted = model.status === "COMPLETED";

  /**
   * canTrain: normal PENDING/FAILED models, PLUS uploaded models that are
   * READY (freshly uploaded, never been trained).
   */
  const canTrain =
    model.status === "PENDING" ||
    model.status === "FAILED" ||
    (isUploaded && model.status === "READY");

  /**
   * canRetrain: only after at least one training run completed.
   * READY means "just uploaded, never trained" — not eligible for retrain.
   */
  const canRetrain = isCompleted && isUserOwned;

  const dataset  = datasets?.find((d) => d.id === model.dataset_id);
  const baseInfo = BASE_MODEL_INFO[model.base_model_key ?? ""];

  const { logs, isDone } = useTrainingLogs(
    isTraining ? model.id : null,
    isTraining,
  );

  /**
   * Resolve which dataset to use.
   * - Uploaded models always need the user to pick (no dataset_id on the model).
   * - Fine-tuned models use the dataset attached at registration.
   */
  const getEffectiveDataset = () => {
    if (isUploaded) {
      return datasets?.find((d) => d.id === selectedDatasetId) ?? null;
    }
    return dataset ?? null;
  };

  /**
   * Resolve which base_model_key to send for training.
   * - Uploaded models: user picks one from SUPPORTED_BASE_MODELS.
   * - Fine-tuned models: use the key they were registered with.
   */
  const getEffectiveBaseModel = () => {
    if (isUploaded) return selectedBaseModel;
    return model.base_model_key || "llama3.2-1b";
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
    startTraining.mutate(
      {
        modelId: model.id,
        datasetPath: eff.file_path,
        baseModelKey: getEffectiveBaseModel(),
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

  // ── Shared training controls UI ──────────────────────────────────────────
  const TrainingControls = ({ isRetrain = false }: { isRetrain?: boolean }) => (
    <div className="flex flex-col gap-2">
      {/* Dataset picker (always needed for uploaded models; also for retrain of fine-tuned) */}
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

      {/* Base model picker — only for uploaded models */}
      {isUploaded && (
        <BaseModelSelector
          value={selectedBaseModel}
          onChange={setSelectedBaseModel}
        />
      )}

      {/* Params toggle */}
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
        <TrainingParamsPanel params={trainParams} onChange={setTrainParams} />
      )}

      <Button
        size="sm"
        variant={isRetrain ? "outline" : "default"}
        className="h-7 self-start text-xs"
        onClick={handleStartTraining}
        disabled={
          startTraining.isPending ||
          (isUploaded ? !selectedDatasetId : !dataset)
        }
      >
        {isRetrain ? (
          <RotateCcw className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {startTraining.isPending
          ? "Starting…"
          : isRetrain
          ? "Retrain"
          : "Start training"}
      </Button>
    </div>
  );

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
        {/* Delete button */}
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

        {/* Base model info chip (system models only) */}
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

        {/* Inline progress */}
        {(isTraining || (isDone && logs.length > 0)) && (
          <InlineProgress logs={logs} isDone={isDone} isTraining={isTraining} />
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

        {/* Actions */}
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>

          {/* TRAIN — PENDING / FAILED / (uploaded + READY) */}
          {canTrain && <TrainingControls isRetrain={false} />}

          {/* RETRAIN — only after a training run has completed */}
          {canRetrain && !isTraining && (
            <div className="flex flex-col gap-2">
              {!isDone && <div className="h-px w-full bg-border" />}

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

              {showRetrainPanel && <TrainingControls isRetrain={true} />}
            </div>
          )}

          {/* Footer */}
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

      {/* Confirm delete */}
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