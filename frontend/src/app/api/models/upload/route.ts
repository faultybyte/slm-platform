import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api/session";

/**
 * Pipes the multipart upload directly to the backend without buffering or
 * re-parsing the form in Next.js. This avoids "Invalid upload form" errors
 * caused by Next.js trying to parse large multipart bodies before forwarding.
 */
export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ message: "Invalid upload form." }, { status: 400 });
  }

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:8000";

  try {
    // Forward the raw request body + boundary directly — no re-parsing
    const res = await fetch(`${API_URL}/models/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Must forward the exact content-type (includes the multipart boundary)
        "content-type": contentType,
      },
      body: req.body,
      // @ts-expect-error — Node 18 fetch requires duplex when body is a stream
      duplex: "half",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.detail ?? data?.message ?? "Upload failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[upload-model] proxy error:", err);
    return NextResponse.json({ message: "Failed to upload model" }, { status: 500 });
  }
}