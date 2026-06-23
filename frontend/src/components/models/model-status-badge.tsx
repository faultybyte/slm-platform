import { Badge } from "@/components/ui/badge";
import type { ModelStatus } from "@/types/api";

const variants: Record<ModelStatus, "default" | "warning" | "success" | "destructive" | "secondary"> = {
  PENDING: "secondary",
  TRAINING: "warning",
  READY: "success",
  COMPLETED: "success",
  FAILED: "destructive",
  PAUSED: "warning",
};

const labels: Record<ModelStatus, string> = {
  PENDING: "Pending",
  TRAINING: "Training",
  READY: "Ready",
  COMPLETED: "Ready",
  FAILED: "Failed",
  PAUSED: "Paused",
};

export function ModelStatusBadge({ status }: { status: ModelStatus }) {
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {labels[status] ?? status}
    </Badge>
  );
}
