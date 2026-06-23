"use client";

import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { modelsQueryKey } from "./use-models";

export function useTrainingLogs(modelId: number | null, isTraining: boolean) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const queryClient = useQueryClient();

  // Load historical logs when we have a modelId. This ensures logs persist
  // across navigation and are available even when the SSE stream is not active.
  useEffect(() => {
    if (!modelId) {
      setLogs([]);
      setIsDone(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/models/${modelId}/logs`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;

        // Backend returns { logs: string } or { model_id, status, logs }
        const text = typeof body === "string" ? body : (body.logs ?? "");
        const lines = text.split(/\r?\n/).filter(Boolean);
        setLogs(lines);

        // Detect completion markers in historical logs
        if (text.includes("JOB_FINISHED") || text.toLowerCase().includes("training successfully completed")) {
          setIsDone(true);
        } else {
          setIsDone(false);
        }
      } catch (err) {
        // ignore fetch errors — we'll rely on streaming if active
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modelId]);

  // SSE subscription — append to existing historical logs rather than replacing.
  useEffect(() => {
    // Only open stream when training is active
    if (!modelId || !isTraining) return;

    // Avoid reopening if already connected
    if (esRef.current) return;

    const es = new EventSource(`/api/models/${modelId}/logs/stream`);
    esRef.current = es;

    const handleLog = (e: MessageEvent) => {
      const line: string = e.data;
      setLogs((prev) => {
        // Avoid duplicate final marker entries
        if (prev.length && prev[prev.length - 1] === line) return prev;
        return [...prev, line];
      });
    };

    const handleComplete = () => {
      setIsDone(true);
      // Close and null the ref so future mounts can reconnect
      es.close();
      esRef.current = null;
    };

    es.addEventListener("log", handleLog as EventListener);
    es.addEventListener("complete", handleComplete as EventListener);

    es.onerror = () => {
      // Treat stream error as completed to avoid endless reconnects
      setIsDone(true);
      try {
        es.close();
      } catch {}
      esRef.current = null;
    };

    return () => {
      try {
        es.close();
      } catch {}
      esRef.current = null;
    };
  }, [modelId, isTraining]);

  // Listen for synthetic client-side notes (e.g., training stopped by user)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const payload = ce?.detail as { modelId?: number; line?: string } | undefined;
      if (!payload || payload.modelId !== modelId) return;
      if (payload.line) setLogs((prev) => [...prev, payload.line]);
    };
    window.addEventListener("training:note", handler as EventListener);
    return () => window.removeEventListener("training:note", handler as EventListener);
  }, [modelId]);

  // When a job completes, refresh model list so status updates immediately
  useEffect(() => {
    if (isDone) {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    }
  }, [isDone, queryClient]);

  return { logs, isDone };
}
