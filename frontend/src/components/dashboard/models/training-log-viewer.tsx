"use client";

import { useEffect, useRef } from "react";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

function parseProgress(logs: string[]): number | null {
  // Try to find a progress % in the latest log lines
  for (let i = logs.length - 1; i >= 0; i--) {
    const match = logs[i].match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) return Math.min(100, parseFloat(match[1]));
    const stepMatch = logs[i].match(/step\s+(\d+)\s*\/\s*(\d+)/i);
    if (stepMatch) {
      return Math.min(100, Math.round((Number(stepMatch[1]) / Number(stepMatch[2])) * 100));
    }
    const epochMatch = logs[i].match(/epoch\s+(\d+)\s*\/\s*(\d+)/i);
    if (epochMatch) {
      return Math.min(100, Math.round((Number(epochMatch[1]) / Number(epochMatch[2])) * 100));
    }
  }
  return null;
}

export function TrainingLogViewer({
  modelId,
  isTraining,
}: {
  modelId: number;
  isTraining: boolean;
}) {
  const { logs, isDone } = useTrainingLogs(modelId, isTraining);
  const bottomRef = useRef<HTMLDivElement>(null);
  const parsedProgress = parseProgress(logs);
  // Animate to 100 when done, else use parsed or indeterminate
  const progressValue = isDone ? 100 : (parsedProgress ?? (isTraining && logs.length > 0 ? 15 : null));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Training logs
        </span>
        {isTraining && !isDone && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Training in progress
          </span>
        )}
        {isDone && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Training done
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(isTraining || isDone) && progressValue !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-medium">{progressValue}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isDone ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
      )}

      {/* Indeterminate bar when no parseable progress yet */}
      {isTraining && !isDone && progressValue === null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-primary animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Log terminal */}
      <div className="h-56 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5">
        {logs.length === 0 ? (
          <span className="text-muted-foreground">
            {isTraining ? "Waiting for logs…" : "No logs yet."}
          </span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap",
                line.toLowerCase().includes("error") && "text-destructive",
                (line.toLowerCase().includes("completed") || line.toLowerCase().includes("done")) &&
                  "text-emerald-600 font-medium",
                line.toLowerCase().includes("warning") && "text-amber-600"
              )}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {isDone && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Model training complete. Your fine-tuned model is ready to use.
          </p>
        </div>
      )}
    </div>
  );
}
