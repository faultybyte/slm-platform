"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegisterModel } from "@/lib/hooks/use-model-actions";
import { useDatasets } from "@/lib/hooks/use-datasets";

const BASE_MODELS = ["llama3.2-1b", "qwen2.5-3b", "deepseek-r1-distill-qwen-1.5b", "gemma3-1b"];

export function RegisterModelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [datasetId, setDatasetId] = useState<string>("");
  const [baseModelKey, setBaseModelKey] = useState("llama3.2-1b");

  const { data: datasets, isLoading: datasetsLoading } = useDatasets();
  const register = useRegisterModel();

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
          setBaseModelKey("llama3.2-1b");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register model</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              placeholder="e.g. HRMind-v1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="base-model">Base model</Label>
            <select
              id="base-model"
              value={baseModelKey}
              onChange={(e) => setBaseModelKey(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {BASE_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="dataset">Dataset</Label>
            <select
              id="dataset"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              disabled={datasetsLoading || !datasets?.length}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            >
              <option value="" disabled>
                {datasetsLoading ? "Loading..." : datasets?.length ? "Select dataset" : "No datasets yet"}
              </option>
              {datasets?.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.filename} {d.row_count ? `(${d.row_count} rows)` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={register.isPending}>
            {register.isPending ? "Registering..." : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}