import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api/session";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND}/datasets/${id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Download failed");
    return NextResponse.json({ message: text }, { status: res.status });
  }

  // Stream the file straight through — no buffering in memory
  const contentDisposition = res.headers.get("content-disposition") ?? `attachment; filename="dataset_${id}.jsonl"`;
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": contentDisposition,
    },
  });
}
