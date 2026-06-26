"use client";
 
import { useMemo } from "react";
import { useEffect } from "react";
import { useModels } from "@/lib/hooks/use-models";
import { cn } from "@/lib/utils";
import { BrainCircuit, Sparkles, Loader2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
 
export function ModelSelector({
  value,
  onChange,
}: {
  value: string | "";
  onChange: (id: string) => void;
}) {
  const { data: models, isLoading } = useModels();
 
  const baseModels = useMemo(
    () => models?.filter((m) => m.is_base_model) ?? [],
    [models],
  );
  const userModels = useMemo(
    () => models?.filter((m) => !m.is_base_model) ?? [],
    [models],
  );
 
  useEffect(() => {
    if (!models) return;
    const exists = models.some((m) => String(m.id) === String(value));
    if (!exists && value !== "") {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);
 
  const selectedModel = useMemo(
    () => models?.find((m) => String(m.id) === value),
    [models, value],
  );
 
  const getStatusInfo = (status: string) => {
    const s = status.toUpperCase();
    if (s === "READY" || s === "COMPLETED") {
      return {
        available: true,
        label: "Ready",
        dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
      };
    }
    if (s === "TRAINING") {
      return {
        available: false,
        label: "Training",
        dot: "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]",
      };
    }
    return {
      available: false,
      label: status.toLowerCase(),
      dot: "bg-destructive/80",
    };
  };
 
  return (
    <Select
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={isLoading || !models?.length}
    >
      {/* Added an inline style block here to force scale suppression */}
      <SelectTrigger
        style={{ transform: "none" }}
        className={cn(
          "no-scale h-9 w-full rounded-xl border-input/60 bg-background/50 backdrop-blur-sm px-3 shadow-sm transition-all",
          "hover:bg-accent/50 hover:border-accent-foreground/20",
          "focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !value && "text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedModel ? (
            <>
              {selectedModel.is_base_model ? (
                <BrainCircuit className="h-4 w-4 text-primary/70 shrink-0" />
              ) : (
                <Sparkles className="h-4 w-4 text-accent-foreground/70 shrink-0" />
              )}
            </>
          ) : null}
 
          <SelectValue
            placeholder={isLoading ? "Loading models..." : "Select a model"}
          />
        </div>
      </SelectTrigger>
 
      <SelectContent className="rounded-xl shadow-lg border-muted/50 backdrop-blur-xl bg-background/95">
        {!models?.length && !isLoading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No models available
          </div>
        )}
 
        {userModels.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 mt-1">
              <Sparkles className="h-3.5 w-3.5" />
              Your Models
            </SelectLabel>
            {userModels.map((m) => {
              const { available, label, dot } = getStatusInfo(m.status);
 
              return (
                /* Added inline transform freeze here */
                <SelectItem
                  key={m.id}
                  value={String(m.id)}
                  disabled={!available}
                  style={{ transform: "none" }}
                  className={cn(
                    "no-scale rounded-lg mx-1 my-0.5 cursor-pointer transition-colors focus:bg-accent/80 hover:scale-100",
                    "[&>span]:w-full", // Forces the Radix inner span to stretch to the edge
                    !available && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between w-full min-w-[200px] gap-4">
                    {/* Added flex-1 and text-left to push the right-side content away */}
                    <span className="font-medium truncate flex-1 text-left">
                      {m.display_name}
                    </span>
                    {/* Removed ml-auto, as justify-between on the parent handles it now */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!available && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {label}
                        </span>
                      )}
                      <div className={cn("h-2 w-2 rounded-full", dot)} />
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectGroup>
        )}
 
        {userModels.length > 0 && baseModels.length > 0 && (
          <SelectSeparator className="mx-2 my-2 opacity-50" />
        )}
 
        {baseModels.length > 0 && (
          <SelectGroup>
            <SelectLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
              <BrainCircuit className="h-3.5 w-3.5" />
              System Models
            </SelectLabel>
            {baseModels.map((m) => (
              /* Added inline transform freeze here */
              <SelectItem
                key={m.id}
                value={String(m.id)}
                style={{ transform: "none" }}
                className="rounded-lg mx-1 my-0.5 cursor-pointer transition-colors focus:bg-accent/80 hover:scale-100"
              >
                <span className="font-medium">{m.display_name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
 
 