"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserSettings {
  // Identity
  email: string;
  display_name: string;

  // Model prefs
  default_model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  context_window: number;

  // Storage
  datasets_root: string;
  adapters_root: string;
  uploaded_models_root: string;
  logs_root: string;
  base_models_root: string;

  // Docker
  docker_image: string;
  docker_healthcheck_timeout: number;

  // General
  theme: string;
}

export type SettingsPatch = Partial<Omit<UserSettings, "email">>;

// ── Query key ──────────────────────────────────────────────────────────────────

export const settingsQueryKey = ["settings"] as const;

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: () => apiClient<UserSettings>("/api/settings"),
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) =>
      apiClient<UserSettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsQueryKey, updated);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      apiClient<{ ok: boolean }>("/api/settings/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}
