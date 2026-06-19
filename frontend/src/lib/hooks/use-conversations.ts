"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { ConversationSummary } from "@/types/api";

export const conversationsQueryKey = ["conversations"] as const;

export function useConversations() {
  return useQuery({
    queryKey: conversationsQueryKey,
    queryFn: () => apiClient<ConversationSummary[]>("/api/conversations"),
  });
}
