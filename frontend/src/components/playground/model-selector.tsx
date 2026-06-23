"use client";

import { useEffect } from "react";
import { useModels } from "@/lib/hooks/use-models";
import { cn } from "@/lib/utils";

export function ModelSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { data: models, isLoading } = useModels();

  const baseModels = models?.filter((m) => m.is_base_model) ?? [];
  const userModels = models?.filter((m) => !m.is_base_model) ?? [];

  useEffect(() => {
    if (!models) return;
    const exists = models.some((m) => String(m.id) === String(value));
    if (!exists && value !== null) {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const isAvailable = (status: string) => {
    const s = status.toUpperCase();
    return s === "READY" || s === "COMPLETED";
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
        {isLoading ? "Loading…" : models?.length ? "Select model" : "No models yet"}
      </option>

      {userModels.length > 0 && (
        <optgroup label="Your models">
          {userModels.map((m) => {
            const available = isAvailable(m.status);
            return (
              <option key={m.id} value={String(m.id)} disabled={!available}>
                {m.display_name}
                {m.status.toUpperCase() === "TRAINING" ? " (training…)" : ""}
                {!available && m.status.toUpperCase() !== "TRAINING" ? ` (${m.status.toLowerCase()})` : ""}
              </option>
            );
          })}
        </optgroup>
      )}

      {baseModels.length > 0 && (
        <optgroup label="System models">
          {baseModels.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.display_name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Clear selection if the currently selected model no longer exists
// (e.g., it was deleted). This keeps parent state in sync with available models.
export default ModelSelector;
