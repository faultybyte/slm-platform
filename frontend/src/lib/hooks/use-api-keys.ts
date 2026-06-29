"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: number;
  name: string;
  prefix: string;
  is_active: boolean;
  token_limit: number | null;
  tokens_used: number;
  usage_pct: number;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateKeyResponse {
  message: string;
  plain_text_key: string;
  key: ApiKeyRow;
}

export interface UsageLogEntry {
  id: number;
  model_id: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number | null;
  status_code: number;
  pii_blocked: boolean;
  created_at: string;
}

// ── Query keys ─────────────────────────────────────────────────────────────────

export const apiKeysQueryKey = ["api-keys"] as const;

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeysQueryKey,
    queryFn: () => apiClient<ApiKeyRow[]>("/api/api-keys"),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; token_limit?: number | null }) =>
      apiClient<CreateKeyResponse>("/api/api-keys", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<void>(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      name?: string;
      token_limit?: number | null;
      is_active?: boolean;
    }) =>
      apiClient<ApiKeyRow>(`/api/api-keys/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
    },
  });
}