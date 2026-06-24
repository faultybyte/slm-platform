import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/api/session";
import { LayoutRouter } from "@/components/dashboard/layout-router";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  return <LayoutRouter>{children}</LayoutRouter>;
}
