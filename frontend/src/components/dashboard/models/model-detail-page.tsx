"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Cpu, Upload, Database, Calendar, Hash, Layers, Loader2, X, CheckCircle2, Zap, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelStatusBadge } from "@/components/models/model-status-badge";
import { ModelStatusDot } from "@/components/dashboard/model-status-dot";
import { TrainingLogViewer } from "@/components/models/training-log-viewer";
import { useModels } from "@/lib/hooks/use-models";
import { useDatasets } from "@/lib/hooks/use-datasets";
import { useStartTraining, useDeleteModel } from "@/lib/hooks/use-model-actions";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const BASE_MODEL_INFO: Record<string, { params: string; hfId: string; speed: string; useCase: string; goodFor: string[] }> = {
  tinyllama: {
    params: "1.1B",
    hfId: "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    speed: "Fast — runs on CPU",
    useCase: "Well-rounded compact model tuned for chat. Best for Q&A, classification, and short-form generation tasks where inference speed matters more than raw capability.",
    goodFor: ["Q&A / FAQ bots", "Text classification", "Short-form generation", "CPU inference"],
  },
  qwen: {
    params: "0.5B",
    hfId: "Qwen/Qwen1.5-0.5B-Chat",
    speed: "Very fast — minimal VRAM",
    useCase: "Ultra-compact multilingual model. Ideal for resource-constrained deployments or rapid iteration when you need a quick fine-tune baseline.",
    goodFor: ["Multilingual tasks", "Low-resource hardware", "Rapid prototyping", "Edge deployment"],
  },
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

export default function ModelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [showLogs, setShowLogs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: models, isLoading } = useModels();
  const { data: datasets } = useDatasets();
  const startTraining = useStartTraining();
  const deleteModel = useDeleteModel();

  const model = models?.find((m) => String(m.id) === params.id);
  const dataset = datasets?.find((d) => d.id === model?.dataset_id);

  const isTraining = model?.status === "TRAINING";
  const canTrain = model?.status === "PENDING" || model?.status === "FAILED";
  const isUserOwned = !model?.is_base_model;
  const baseInfo = BASE_MODEL_INFO[model?.base_model_key ?? ""];

  // SSE live logs
  const { logs, isDone } = useTrainingLogs(isTraining ? (model?.id ?? null) : null, !!isTraining);

  const handleStartTraining = () => {
    if (!model || !dataset) { toast.error("Dataset not found for this model."); return; }
    startTraining.mutate(
      { modelId: model.id, datasetPath: dataset.file_path },
      {
        onSuccess: () => { toast.success("Training started."); setShowLogs(true); },
        onError: (err) => toast.error(err.message),
      }
    );
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
                  <div className="px-4"><MetaRow icon={Cpu} label="Architecture / base" value={model.base_model_key} /></div>
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
                  <div className="px-4"><MetaRow icon={Hash} label="Model ID" value={<span className="font-mono text-xs">#{model.id}</span>} /></div>
                  <div className="px-4"><MetaRow icon={Calendar} label="Added" value={new Date(model.created_at).toLocaleString()} /></div>
                  {baseInfo && (
                    <div className="px-4"><MetaRow icon={Cpu} label="Parameters" value={`${baseInfo.params} params`} /></div>
                  )}
                </div>
              </div>

              {/* Base model details — system only */}
              {model.is_base_model && baseInfo && (
                <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About this model</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{baseInfo.useCase}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    <span>{baseInfo.speed}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Best used for</span>
                    <div className="flex flex-wrap gap-1.5">
                      {baseInfo.goodFor.map((tag) => (
                        <span key={tag} className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-[11px] font-mono text-muted-foreground">{baseInfo.hfId}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right — actions */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</h2>

              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                {/* Training done banner */}
                {isDone && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Model training done</p>
                  </div>
                )}

                {/* Progress bar */}
                <ProgressBar logs={logs} isDone={isDone} isTraining={!!isTraining} />

                {canTrain && (
                  <Button
                    size="sm" className="w-full justify-start"
                    onClick={handleStartTraining}
                    disabled={startTraining.isPending || !dataset}
                  >
                    {startTraining.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {startTraining.isPending ? "Starting…" : "Start training"}
                  </Button>
                )}

                {(isTraining || model.status === "COMPLETED" || model.status === "READY" || isDone) && (
                  <Button
                    size="sm" variant="outline" className="w-full justify-start"
                    onClick={() => setShowLogs((v) => !v)}
                  >
                    {showLogs ? "Hide training logs" : "View training logs"}
                  </Button>
                )}

                {isTraining && !isDone && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Training in progress…
                  </div>
                )}

                {canTrain && !dataset && (
                  <p className="text-xs text-muted-foreground">No dataset attached — training is unavailable.</p>
                )}
              </div>
            </div>
          </div>

          {/* Training logs — full width */}
          {showLogs && (
            <div className="mt-6">
              <TrainingLogViewer modelId={model.id} isTraining={!!isTraining} />
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
