import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/api/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
