"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useTrainingLogs } from "@/lib/hooks/use-training-logs";
import { cn } from "@/lib/utils";

function LossChart({ logs }: { logs: string[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; idx: number } | null>(null);

  // Parse lines like 'Loss: 0.1234' optionally with 'epoch' metadata
  const points = useMemo(() => {
    const p: number[] = [];
    for (const line of logs) {
      const m = line.match(/loss[:\s]+([0-9]*\.?[0-9]+)/i);
      if (m) p.push(Number(m[1]));
    }
    return p;
  }, [logs]);

  if (points.length === 0) return null;

  const width = 420;
  const height = 120;
  const padding = 12;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const coords = points.map((v, i) => {
    const x = padding + (i / (points.length - 1 || 1)) * innerW;
    const y = padding + innerH - ((v - min) / span) * innerH;
    return { x, y, v };
  });

  const polyPoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="mt-3 relative" ref={containerRef}>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Loss / Epoch</h3>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="rounded-md border bg-card">
        {/* grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#111827" strokeWidth={0.5} />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#111827" strokeWidth={0.5} />
        <polyline fill="none" stroke="#10b981" strokeWidth={2} points={polyPoints} />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={3}
            fill="#10b981"
            className="cursor-pointer"
            onMouseEnter={() => setTooltip({ x: c.x, y: c.y, value: Number(c.v.toFixed(6)), idx: i + 1 })}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {tooltip && (
        <div
          className="absolute z-20 -translate-y-full rounded-md bg-muted/90 px-2 py-1 text-xs shadow"
          style={{ left: Math.max(8, tooltip.x - 40) }}
        >
          <div className="font-medium">Epoch {tooltip.idx}</div>
          <div className="text-muted-foreground">Loss: {tooltip.value}</div>
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Training logs
        </span>
        {isTraining && !isDone && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Training
          </span>
        )}
        {isDone && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        )}
      </div>

      <div className="h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5">
        {logs.length === 0 ? (
          <span className="text-muted-foreground">
            {isTraining ? "Waiting for logs..." : "No logs yet."}
          </span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap",
                line.toLowerCase().includes("error") && "text-destructive",
                line.toLowerCase().includes("completed") && "text-emerald-600 font-medium"
              )}
            >
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <LossChart logs={logs} />
    </div>
  );
}