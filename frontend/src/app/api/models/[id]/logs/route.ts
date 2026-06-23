import { NextRequest } from "next/server";
import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  return proxyAuthenticatedGet(`/models/${id}/logs`);
}
