import { NextRequest, NextResponse } from "next/server";
import { BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";
import { API_URL } from "@/lib/config";

/**
 * Proxies a user-uploaded model file directly to the FastAPI /models/upload endpoint.
 * The backend saves the file and registers it with status=READY so it's immediately
 * available for chat without any training step.
 */
export async function POST(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload form." }, { status: 400 });
  }

  const displayName = formData.get("display_name");
  const baseModelKey = formData.get("base_model_key") ?? "custom";
  const file = formData.get("file");

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ message: "display_name is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required." }, { status: 400 });
  }

  try {
    // Forward the multipart form directly to FastAPI
    const upstream = new FormData();
    upstream.append("file", file, file.name);
    upstream.append("display_name", displayName.trim());
    upstream.append("base_model_key", String(baseModelKey));

    const res = await fetch(`${API_URL}/models/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstream,
      // @ts-expect-error — duplex needed for Node 18+ streaming
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
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Failed to upload model" }, { status: 500 });
  }
}
