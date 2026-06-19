"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ModelSummary } from "@/types/api";

export const modelsQueryKey = ["models"] as const;

export function useModels() {
  return useQuery({
    queryKey: modelsQueryKey,
    queryFn: () => apiClient<ModelSummary[]>("/api/models"),
  });
}
