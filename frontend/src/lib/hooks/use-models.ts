"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ModelSummary } from "@/types/api";

export const modelsQueryKey = ["models"] as const;

export function useModels() {
  return useQuery({
    queryKey: modelsQueryKey,
    queryFn: () => apiClient<ModelSummary[]>("/api/models"),
    refetchInterval: (query) => {
      const models = query.state.data;
      return models?.some((model) => model.status === "TRAINING") ? 3000 : false;
    },
  });
}
