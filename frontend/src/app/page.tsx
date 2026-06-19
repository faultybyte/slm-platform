import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/api/session";

export default async function RootPage() {
  const token = await getSessionToken();
  redirect(token ? "/dashboard" : "/login");
}
