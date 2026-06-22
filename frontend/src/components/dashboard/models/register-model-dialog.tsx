"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRegisterModel } from "@/lib/hooks/use-model-actions";
import { useDatasets } from "@/lib/hooks/use-datasets";
import { Cpu, Zap, Info } from "lucide-react";

const BASE_MODELS: Record<
  string,
  { label: string; params: string; speed: string; useCase: string; badge: string }
> = {
  tinyllama: {
    label: "TinyLlama 1.1B",
    params: "1.1B parameters",
    speed: "Fast — runs on CPU",
    useCase: "Best for lightweight Q&A, classification, and short-form generation tasks where speed matters.",
    badge: "Recommended",
  },
  qwen: {
    label: "Qwen 0.5B",
    params: "0.5B parameters",
    speed: "Very fast — minimal VRAM",
    useCase: "Ideal for ultra-low-resource environments or rapid prototyping. Good multilingual baseline.",
    badge: "Compact",
  },
};

export function RegisterModelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [datasetId, setDatasetId] = useState<string>("");
  const [baseModelKey, setBaseModelKey] = useState("tinyllama");

  const { data: datasets, isLoading: datasetsLoading } = useDatasets();
  const register = useRegisterModel();

  const selectedMeta = BASE_MODELS[baseModelKey];

  const handleSubmit = () => {
    if (!displayName.trim() || !datasetId) {
      toast.error("Name and dataset are required.");
      return;
    }

    register.mutate(
      { display_name: displayName.trim(), dataset_id: Number(datasetId), base_model_key: baseModelKey },
      {
        onSuccess: () => {
          toast.success(`Model "${displayName}" registered.`);
          onOpenChange(false);
          setDisplayName("");
          setDatasetId("");
          setBaseModelKey("tinyllama");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fine-tune a model</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              placeholder="e.g. HRMind-v1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Base model picker */}
          <div className="flex flex-col gap-2">
            <Label>Base model</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BASE_MODELS).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBaseModelKey(key)}
                  className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    baseModelKey === key
                      ? "border-foreground bg-secondary"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1">
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{meta.badge}</Badge>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Cpu className="h-3 w-3" /> {meta.params}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Zap className="h-3 w-3" /> {meta.speed}
                  </span>
                </button>
              ))}
            </div>

            {/* Use case hint */}
            {selectedMeta && (
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{selectedMeta.useCase}</p>
              </div>
            )}
          </div>

          {/* Dataset */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset">Training dataset</Label>
            <select
              id="dataset"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              disabled={datasetsLoading || !datasets?.length}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="" disabled>
                {datasetsLoading ? "Loading…" : datasets?.length ? "Select dataset" : "No datasets yet — upload one first"}
              </option>
              {datasets?.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.filename}
                  {d.row_count ? ` (${d.row_count} rows)` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={register.isPending || !displayName.trim() || !datasetId}>
            {register.isPending ? "Registering…" : "Register model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
