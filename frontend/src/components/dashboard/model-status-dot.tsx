import { cn } from "@/lib/utils";
import type { ModelStatus } from "@/types/api";

const STATUS_STYLES: Record<ModelStatus, string> = {
  pending: "bg-muted-foreground/40",
  training: "bg-amber-500 animate-pulse",
  completed: "bg-emerald-500",
  ready: "bg-emerald-500",
  failed: "bg-destructive",
};

export function ModelStatusDot({ status }: { status: ModelStatus }) {
  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", STATUS_STYLES[status])}
      aria-label={status}
      title={status}
    />
  );
}
