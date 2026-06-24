"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export function LayoutRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Settings renders its own header and sidebar — skip the main dashboard shell
  if (pathname.startsWith("/dashboard/settings")) {
    return <>{children}</>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
