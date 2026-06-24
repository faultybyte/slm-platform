import { NextRequest } from "next/server";
import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyAuthenticatedGet(`/models/${id}/logs`);
}
