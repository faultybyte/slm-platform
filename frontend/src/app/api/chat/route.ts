import { NextRequest } from "next/server";
import { backendFetch } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return new Response(JSON.stringify({ message: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();

  let upstream: Response;
  try {
    upstream = await backendFetch("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      token,
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    const isHeadersTimeout = err?.cause?.code === "UND_ERR_HEADERS_TIMEOUT" || String(err?.message).includes("Headers Timeout");
    const msg = isHeadersTimeout
      ? "Upstream timed out while preparing the response headers. The request may still be processing on the server."
      : "Failed to contact upstream service.";
    return new Response(JSON.stringify({ message: msg }), { status: 504, headers: { "Content-Type": "application/json" } });
  }

  // Stream the FastAPI SSE response straight through — no buffering.
  // backendFetch returns the raw Response so we can pipe ReadableStream directly.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}