"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { modelsQueryKey } from "@/lib/hooks/use-models";
import type { ModelSummary, RegisterModelRequest, TrainingParams } from "@/types/api";

export function useRegisterModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: RegisterModelRequest) =>
      apiClient<ModelSummary>("/api/models", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    },
  });
}

export function useStartTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      modelId,
      datasetPath,
      baseModelKey,
      trainingParams,
    }: {
      modelId: number;
      datasetPath: string;
      baseModelKey?: string;
      trainingParams?: TrainingParams;
    }) =>
      apiClient(`/api/models/${modelId}/train`, {
        method: "POST",
        body: JSON.stringify({
          dataset_path: datasetPath,
          base_model_key: baseModelKey ?? "tinyllama",
          ...(trainingParams ?? {}),
        }),
      }),
    onMutate: async (variables) => {
      const mId = (variables as any)?.modelId as number;
      await queryClient.cancelQueries({ queryKey: modelsQueryKey });
      const previous = queryClient.getQueryData(modelsQueryKey);
      queryClient.setQueryData(modelsQueryKey, (old: any) => {
        if (!old) return old;
        return (old as any).map((m: any) => (m.id === mId ? { ...m, status: "TRAINING" } : m));
      });
      try {
        window.dispatchEvent(new CustomEvent("training:started", { detail: { modelId: mId } }));
      } catch {}
      return { previous };
    },
    onError: (_err, _variables, context: any) => {
      queryClient.setQueryData(modelsQueryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: modelsQueryKey }),
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/models/${id}`, { method: "DELETE" }).then(async (res) => {
        if (!res.ok && res.status !== 204) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? "Delete failed");
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    },
  });
}

export function useStopTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: number) =>
      fetch(`/api/models/${modelId}/stop`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? "Stop failed");
        }
        return res.json().catch(() => ({}));
      }),
    onMutate: async (modelId: number) => {
      await queryClient.cancelQueries({ queryKey: modelsQueryKey });
      const previous = queryClient.getQueryData(modelsQueryKey);
      queryClient.setQueryData(modelsQueryKey, (old: any) => {
        if (!old) return old;
        return (old as any).map((m: any) => (m.id === modelId ? { ...m, status: "FAILED" } : m));
      });
      return { previous };
    },
    onError: (_err, _variables, context: any) => {
      queryClient.setQueryData(modelsQueryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: modelsQueryKey }),
  });
}

export function usePauseTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: number) =>
      fetch(`/api/models/${modelId}/pause`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? "Pause failed");
        }
        return res.json().catch(() => ({}));
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelsQueryKey }),
  });
}

export function useResumeTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (modelId: number) =>
      fetch(`/api/models/${modelId}/resume`, { method: "POST" }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message ?? "Resume failed");
        }
        return res.json().catch(() => ({}));
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelsQueryKey }),
  });
}

export function useUploadModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      displayName,
      baseModelKey,
    }: {
      file: File;
      displayName: string;
      baseModelKey: string;
    }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("display_name", displayName);
      form.append("base_model_key", baseModelKey);
      return fetch("/api/models/upload", { method: "POST", body: form }).then(
        async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message ?? "Upload failed");
          }
          return res.json();
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKey });
    },
  });
}