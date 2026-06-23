"use client";

import { useModels } from "@/lib/hooks/use-models";
import { cn } from "@/lib/utils";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { data: models, isLoading } = useModels();

  const baseModels = models?.filter((m) => m.is_base_model) ?? [];
  const uploadedModels = models?.filter((m) => !m.is_base_model && m.is_uploaded) ?? [];
  const fineTunedModels = models?.filter(
    (m) => !m.is_base_model && !m.is_uploaded
  ) ?? [];

  const isAvailable = (status: string) =>
    ["READY", "COMPLETED"].includes(status.toUpperCase());

  const renderOption = (m: { id: number; display_name: string; status: string }) => {
    const available = isAvailable(m.status);
    const statusLabel =
      m.status.toUpperCase() === "TRAINING"
        ? " (training…)"
        : !available
        ? ` (${m.status.toLowerCase()})`
        : "";
    return (
      <option key={m.id} value={String(m.id)} disabled={!available}>
        {m.display_name}{statusLabel}
      </option>
    );
  };

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={isLoading || !models?.length}
      className={cn(
        "h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <option value="" disabled>
        {isLoading ? "Loading…" : models?.length ? "Select model" : "No models available"}
      </option>

      {fineTunedModels.length > 0 && (
        <optgroup label="Fine-tuned models">
          {fineTunedModels.map(renderOption)}
        </optgroup>
      )}

      {uploadedModels.length > 0 && (
        <optgroup label="Uploaded models">
          {uploadedModels.map(renderOption)}
        </optgroup>
      )}

      {baseModels.length > 0 && (
        <optgroup label="System models">
          {baseModels.map(renderOption)}
        </optgroup>
      )}
    </select>
  );
}
