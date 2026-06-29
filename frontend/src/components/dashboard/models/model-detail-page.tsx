"use client";
import { Slider } from "@/components/ui/slider";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Cpu, Upload, Database, Calendar, Hash, Layers,
  Loader2, X, CheckCircle2, Zap, Pause, Square, Settings2, ChevronDown,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelStatusBadge } from "@/components/models/model-status-badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { TrainingLogViewer } from "@/components/models/training-log-viewer";
import { useModels } from "@/lib/hooks/use-models";
import { useDatasets } from "@/lib/hooks/use-datasets";
import {
  useStartTraining,
  useDeleteModel,
  useStopTraining,
  usePauseTraining,
  useResumeTraining,
} from "@/lib/hooks/use-model-actions";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import type { TrainingParams } from "@/types/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Supported base models for LoRA fine-tuning
const SUPPORTED_BASE_MODELS = [
  { key: "llama3.2-1b",                   label: "Llama 3.2 1B" },
  { key: "qwen2.5-3b",                    label: "Qwen 2.5 3B" },
  { key: "deepseek-r1-distill-qwen-1.5b", label: "DeepSeek-R1 1.5B" },
  { key: "gemma3-1b",                      label: "Gemma 3 1B" },
];

const DEFAULT_TRAIN_PARAMS: TrainingParams = {
  numEpochs: 3,
  learningRate: 2e-4,
  batchSize: 1,
  warmupSteps: 10,
  maxSeqLength: 512,
};

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value ?? "—"}</span>
      </div>
    </div>
  );
}

function ProgressBar({ logs, isDone, isTraining }: { logs: string[]; isDone: boolean; isTraining: boolean }) {
  let progress: number | null = null;
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = logs[i].match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) { progress = Math.min(100, parseFloat(m[1])); break; }
    const s = logs[i].match(/step\s+(\d+)\s*\/\s*(\d+)/i);
    if (s) { progress = Math.min(100, Math.round((Number(s[1]) / Number(s[2])) * 100)); break; }
    const ep = logs[i].match(/epoch\s+(\d+)\s*\/\s*(\d+)/i);
    if (ep) { progress = Math.min(100, Math.round((Number(ep[1]) / Number(ep[2])) * 100)); break; }
  }
  const pct = isDone ? 100 : (progress ?? (logs.length > 0 ? 15 : null));

  if (!isTraining && !isDone) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isDone ? "Completed" : "Training progress"}
        </span>
        {pct !== null && <span className="text-xs font-semibold">{pct}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        {pct !== null ? (
          <div
            className={cn("h-full rounded-full transition-all duration-500", isDone ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/4 rounded-full bg-primary animate-pulse" />
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
  const [open, setOpen] = useState(false);

  const sliders: { key: keyof TrainingParams; label: string; min: number; max: number; step: number }[] = [
    { key: "numEpochs",    label: "Epochs",          min: 1,  max: 20,   step: 1  },
    { key: "batchSize",    label: "Batch size",      min: 1,  max: 32,   step: 1  },
    { key: "warmupSteps",  label: "Warmup steps",    min: 0,  max: 200,  step: 5  },
    { key: "maxSeqLength", label: "Max seq length",  min: 64, max: 2048, step: 64 },
  ];

  const lrSliderValue = Math.round((params.learningRate ?? 2e-4) / 1e-5);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 rounded-lg transition-colors"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          Training parameters
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t px-3 pb-3 pt-3">
          {sliders.map(({ key, label, min, max, step }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{params[key] as number}</span>
              </div>
              <Slider
                min={min} max={max} step={step}
                value={[params[key] as number]}
                onValueChange={([v]) => onChange({ ...params, [key]: v })}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Learning rate</span>
              <span className="font-medium tabular-nums">{(params.learningRate ?? 2e-4).toExponential(0)}</span>
            </div>
            <Slider
              min={1} max={20} step={1}
              value={[lrSliderValue]}
              onValueChange={([v]) => onChange({ ...params, learningRate: v * 1e-5 })}
            />
            <span className="text-[10px] text-muted-foreground">Range: 1×10⁻⁵ → 2×10⁻⁴</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [showLogs, setShowLogs]         = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isStarting, setIsStarting]     = useState(false);
  const [trainParams, setTrainParams]   = useState<TrainingParams>(DEFAULT_TRAIN_PARAMS);
  // For uploaded models: user picks which HF base model to use for LoRA training
  const [selectedBaseModel, setSelectedBaseModel] = useState("llama3.2-1b");
  // For uploaded models: user picks the dataset
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [showRetrainPanel, setShowRetrainPanel] = useState(false);

  const { data: models, isLoading } = useModels();
  const { data: datasets } = useDatasets();
  const startTraining  = useStartTraining();
  const stopTraining   = useStopTraining();
  const pauseTraining  = usePauseTraining();
  const resumeTraining = useResumeTraining();
  const deleteModel    = useDeleteModel();

  const model   = models?.find((m) => String(m.id) === params.id);
  const dataset = datasets?.find((d) => d.id === model?.dataset_id);

  const isTraining  = model?.status === "TRAINING";
  const isUploaded  = !!model?.is_uploaded;
  const isUserOwned = !model?.is_base_model;
  const trainingActive = !!isTraining || isStarting;

  /**
   * canTrain: normal models (PENDING/FAILED) + uploaded models that are READY
   * but have never been trained (first train run).
   */
  const canTrain =
    !trainingActive &&
    (model?.status === "PENDING" ||
      model?.status === "FAILED" ||
      (isUploaded && model?.status === "READY"));

  /**
   * canRetrain: only after at least one completed training run.
   * READY = uploaded, never trained — not eligible for retrain yet.
   */
  const canRetrain = !trainingActive && model?.status === "COMPLETED" && isUserOwned;

  const { logs, isDone } = useTrainingLogs(trainingActive ? (model?.id ?? null) : null, trainingActive);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const payload = ce?.detail as { modelId?: number } | undefined;
      if (!payload || payload.modelId !== model?.id) return;
      setIsStarting(true);
    };
    window.addEventListener("training:started", handler as EventListener);
    return () => window.removeEventListener("training:started", handler as EventListener);
  }, [model?.id]);

  useEffect(() => {
    if (isTraining || isDone || model?.status === "FAILED") {
      window.setTimeout(() => setIsStarting(false), 0);
    }
  }, [isTraining, isDone, model?.status]);

  const getEffectiveDataset = () => {
    if (isUploaded) return datasets?.find((d) => d.id === selectedDatasetId) ?? null;
    return dataset ?? null;
  };

  const getEffectiveBaseModel = () => {
    if (isUploaded) return selectedBaseModel;
    return model?.base_model_key || "llama3.2-1b";
  };

  const handleStartTraining = () => {
    const eff = getEffectiveDataset();
    if (!eff) {
      toast.error(isUploaded ? "Please select a dataset before training." : "Dataset not found for this model.");
      return;
    }
    if (!model || trainingActive || startTraining.isPending) return;
    setIsStarting(true);
    startTraining.mutate(
      {
        modelId: model.id,
        datasetPath: eff.file_path,
        baseModelKey: getEffectiveBaseModel(),
        trainingParams: trainParams,
      },
      {
        onSuccess: () => { toast.success("Training started."); setShowLogs(true); },
        onError: (err) => { toast.error(err.message); setIsStarting(false); },
      }
    );
  };

  const handlePauseTraining = () => {
    if (!model) return;
    pauseTraining.mutate(model.id, {
      onSuccess: () => toast.success("Training paused."),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleResumeTraining = () => {
    if (!model) return;
    resumeTraining.mutate(model.id, {
      onSuccess: () => toast.success("Training resumed."),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleStopTraining = () => {
    if (!model) return;
    stopTraining.mutate(model.id, {
      onSuccess: () => {
        window.dispatchEvent(new CustomEvent("training:note", { detail: { modelId: model.id, line: `[${new Date().toLocaleTimeString()}] SYSTEM: Training stopped by user.` } }));
        toast.success("Training stopped.");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleDelete = () => {
    if (!model) return;
    deleteModel.mutate(model.id, {
      onSuccess: () => { toast.success(`"${model.display_name}" removed.`); router.push("/dashboard/models"); },
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Model not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/models")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to models
        </Button>
      </div>
    );
  }

  const effectiveStatus = isDone ? "COMPLETED" : model.status;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push("/dashboard/models")}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-2">
          <ModelStatusDot status={effectiveStatus} />
          <h1 className="text-sm font-semibold">{model.display_name}</h1>
          <ModelStatusBadge status={effectiveStatus} />
        </div>
        {isUserOwned && (
          <Button
            variant="ghost" size="sm"
            className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <X className="h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="grid gap-6 md:grid-cols-[1fr_280px]">

            {/* Left — metadata */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-0">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model info</h2>
                <div className="divide-y rounded-xl border bg-card">
                  <div className="px-4">
                    <MetaRow icon={Cpu} label="Architecture / base" value={model.base_model_key} />
                  </div>
                  <div className="px-4">
                    <MetaRow
                      icon={model.is_uploaded ? Upload : Layers}
                      label="Type"
                      value={model.is_base_model ? "System model" : model.is_uploaded ? "User uploaded" : "Fine-tuned"}
                    />
                  </div>
                  {dataset && (
                    <div className="px-4">
                      <MetaRow
                        icon={Database}
                        label="Training dataset"
                        value={
                          <span className="flex items-center gap-1.5">
                            {dataset.filename}
                            {dataset.row_count && (
                              <span className="text-xs font-normal text-muted-foreground">({dataset.row_count} rows)</span>
                            )}
                          </span>
                        }
                      />
                    </div>
                  )}
                  <div className="px-4"><MetaRow icon={Hash} label="Model ID" value={<span className="font-mono text-xs">model_{model.id}</span>} /></div>
                  <div className="px-4"><MetaRow icon={Calendar} label="Added" value={new Date(model.created_at).toLocaleString()} /></div>
                </div>
              </div>
            </div>

            {/* Right — actions */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</h2>

              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                {/* Training done banner */}
                {isDone && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Training complete</p>
                  </div>
                )}

                {/* Progress bar */}
                <ProgressBar logs={logs} isDone={isDone} isTraining={trainingActive} />

                {/* ── TRAIN (first time) ── */}
                {canTrain && (
                  <>
                    {/* Dataset selector for uploaded models */}
                    {isUploaded && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Database className="h-3.5 w-3.5" />
                          Dataset
                        </div>
                        <select
                          value={selectedDatasetId ?? ""}
                          onChange={(e) => setSelectedDatasetId(Number(e.target.value))}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="" disabled>— choose a dataset —</option>
                          {datasets?.map((d) => (
                            <option key={d.id} value={d.id}>{d.filename}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Base model selector for uploaded models */}
                    {isUploaded && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Cpu className="h-3.5 w-3.5" />
                          Base model for LoRA
                        </div>
                        <select
                          value={selectedBaseModel}
                          onChange={(e) => setSelectedBaseModel(e.target.value)}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {SUPPORTED_BASE_MODELS.map((m) => (
                            <option key={m.key} value={m.key}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <TrainingParamsPanel params={trainParams} onChange={setTrainParams} />

                    <Button
                      size="sm" className="w-full justify-start"
                      onClick={handleStartTraining}
                      disabled={
                        startTraining.isPending ||
                        isStarting ||
                        (isUploaded ? !selectedDatasetId : !dataset)
                      }
                    >
                      {startTraining.isPending || isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {startTraining.isPending || isStarting ? "Starting…" : "Start training"}
                    </Button>

                    {isUploaded && !selectedDatasetId && (
                      <p className="text-xs text-muted-foreground">Select a dataset above to enable training.</p>
                    )}
                    {!isUploaded && !dataset && (
                      <p className="text-xs text-muted-foreground">No dataset attached — training is unavailable.</p>
                    )}
                  </>
                )}

                {/* ── RETRAIN (after completed) ── */}
                {canRetrain && (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRetrainPanel((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retrain model
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showRetrainPanel && "rotate-180")} />
                    </button>

                    {showRetrainPanel && (
                      <>
                        {isUploaded && (
                          <>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Dataset</span>
                              <select
                                value={selectedDatasetId ?? ""}
                                onChange={(e) => setSelectedDatasetId(Number(e.target.value))}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                <option value="" disabled>— choose a dataset —</option>
                                {datasets?.map((d) => (
                                  <option key={d.id} value={d.id}>{d.filename}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Base model for LoRA</span>
                              <select
                                value={selectedBaseModel}
                                onChange={(e) => setSelectedBaseModel(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              >
                                {SUPPORTED_BASE_MODELS.map((m) => (
                                  <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                        {!isUploaded && dataset && (
                          <p className="text-xs text-muted-foreground">Dataset: {dataset.filename}</p>
                        )}
                        <TrainingParamsPanel params={trainParams} onChange={setTrainParams} />
                        <Button
                          size="sm" variant="outline" className="w-full justify-start"
                          onClick={handleStartTraining}
                          disabled={
                            startTraining.isPending ||
                            trainingActive ||
                            (isUploaded ? !selectedDatasetId : !dataset)
                          }
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {startTraining.isPending ? "Starting…" : "Retrain"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Pause / Stop during training */}
                {trainingActive && !isDone && (
                  <div className="flex gap-2">
                    <Button
                      size="sm" variant="outline" className="flex-1 justify-start"
                      onClick={handlePauseTraining}
                      disabled={pauseTraining.isPending}
                    >
                      {pauseTraining.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                      {pauseTraining.isPending ? "Pausing…" : "Pause"}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="flex-1 justify-start"
                      onClick={handleStopTraining}
                      disabled={stopTraining.isPending}
                    >
                      {stopTraining.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                      {stopTraining.isPending ? "Stopping…" : "Stop"}
                    </Button>
                  </div>
                )}

                {/* Resume */}
                {model.status === "PAUSED" && (
                  <Button
                    size="sm" variant="outline" className="w-full justify-start"
                    onClick={handleResumeTraining}
                    disabled={resumeTraining.isPending}
                  >
                    {resumeTraining.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {resumeTraining.isPending ? "Resuming…" : "Resume training"}
                  </Button>
                )}

                {/* View logs */}
                {(trainingActive || model.status === "COMPLETED" || model.status === "READY" || isDone) && (
                  <Button
                    size="sm" variant="outline" className="w-full justify-start"
                    onClick={() => setShowLogs((v) => !v)}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {showLogs ? "Hide training logs" : "View training logs"}
                  </Button>
                )}

                {trainingActive && !isDone && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Training in progress…
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Training logs */}
          {showLogs && (
            <div className="mt-6">
              <TrainingLogViewer modelId={model.id} isTraining={trainingActive} />
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove model?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{model.display_name}</span> will be permanently removed. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModel.isPending}>
              {deleteModel.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Removing…</> : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
