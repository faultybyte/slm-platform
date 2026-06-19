"use client";

import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/hooks/use-auth";

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TokenBadge() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <Badge variant="secondary" className="animate-pulse">
        <Zap className="h-3 w-3" />
        <span className="opacity-0">0</span>
      </Badge>
    );
  }

  // tokens_used / token_limit are not in the OpenAPI schema for /auth/me
  // (declared as {}) — render only when present rather than guessing.
  if (user?.tokens_used === undefined) {
    return null;
  }

  const label = user.token_limit
    ? `${formatTokenCount(user.tokens_used)} / ${formatTokenCount(user.token_limit)}`
    : formatTokenCount(user.tokens_used);

  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <Zap className="h-3 w-3" />
      {label}
    </Badge>
  );
}
