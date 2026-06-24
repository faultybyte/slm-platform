"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { modelsQueryKey } from "@/lib/hooks/use-models";
import type { ModelSummary, RegisterModelRequest, TrainingParams } from "@/types/api";

type StartTrainingVariables = {
  modelId: number;
  datasetPath: string;
  baseModelKey?: string;
  trainingParams?: TrainingParams;
};

type ModelsMutationContext = {
  previous?: ModelSummary[];
};

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
    }: StartTrainingVariables) =>
      apiClient(`/api/models/${modelId}/train`, {
        method: "POST",
        body: JSON.stringify({
          dataset_path: datasetPath,
          base_model_key: baseModelKey ?? "tinyllama",
          ...(trainingParams ?? {}),
        }),
      }),
    onMutate: async (variables) => {
      const mId = variables.modelId;
      await queryClient.cancelQueries({ queryKey: modelsQueryKey });
      const previous = queryClient.getQueryData<ModelSummary[]>(modelsQueryKey);
      queryClient.setQueryData<ModelSummary[]>(modelsQueryKey, (old) => {
        if (!old) return old;
        return old.map((m) => (m.id === mId ? { ...m, status: "TRAINING" } : m));
      });
      try {
        window.dispatchEvent(new CustomEvent("training:started", { detail: { modelId: mId } }));
      } catch {}
      return { previous };
    },
    onError: (_err, _variables, context?: ModelsMutationContext) => {
      queryClient.setQueryData(modelsQueryKey, context?.previous);
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<ModelSummary[]>(modelsQueryKey, (old) => {
        if (!old) return old;
        return old.map((m) =>
          m.id === variables.modelId ? { ...m, status: "TRAINING" } : m,
        );
      });
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: modelsQueryKey });
      }, 2000);
    },
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
      const previous = queryClient.getQueryData<ModelSummary[]>(modelsQueryKey);
      // Mark the model as ready to retry (PENDING) so the UI shows a
      // start/retrain affordance. Also emit a client-side note so logs
      // reflect the stop immediately.
      queryClient.setQueryData<ModelSummary[]>(modelsQueryKey, (old) => {
        if (!old) return old;
        return old.map((m) => (m.id === modelId ? { ...m, status: "PENDING", worker_pid: null } : m));
      });
      try {
        window.dispatchEvent(new CustomEvent("training:note", { detail: { modelId, line: `[${new Date().toLocaleTimeString()}] SYSTEM: Training stopped by user.` } }));
      } catch {}
      return { previous };
    },
    onError: (_err, _variables, context?: ModelsMutationContext) => {
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
    onMutate: async (modelId: number) => {
      await queryClient.cancelQueries({ queryKey: modelsQueryKey });
      const previous = queryClient.getQueryData<ModelSummary[]>(modelsQueryKey);
      queryClient.setQueryData<ModelSummary[]>(modelsQueryKey, (old) => {
        if (!old) return old;
        return old.map((m) => (m.id === modelId ? { ...m, status: "PAUSED" } : m));
      });
      return { previous };
    },
    onError: (_err, _variables, context?: ModelsMutationContext) => {
      queryClient.setQueryData(modelsQueryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: modelsQueryKey }),
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
