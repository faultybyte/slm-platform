"use client";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/hooks/use-auth";

export function LogoutButton() {
  const logout = useLogout();

  return (
    <Button
      variant="outline"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      {logout.isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
