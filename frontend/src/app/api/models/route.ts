import { proxyAuthenticatedGet } from "@/lib/api/proxy-helpers";
import type { ModelSummary } from "@/types/api";

export async function GET() {
  return proxyAuthenticatedGet<ModelSummary[]>("/models/");
}
