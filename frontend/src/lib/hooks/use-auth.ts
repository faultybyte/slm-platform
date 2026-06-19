"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import type { RegisterFormValues, LoginFormValues } from "@/lib/validation/auth";
import type { UserResponse, AuthMeResponse } from "@/types/api";

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: RegisterFormValues) =>
      apiClient<UserResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      router.push("/login?registered=1");
    },
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: LoginFormValues) =>
      apiClient<{ ok: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/dashboard");
      router.refresh();
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient<AuthMeResponse>("/api/auth/me"),
    retry: false,
  });
}
