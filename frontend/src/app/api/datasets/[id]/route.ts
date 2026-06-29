import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { pathname } = new URL(req.url);
  const isDownload = pathname.endsWith("/download");

  if (isDownload) {
    try {
      const upstream = await backendFetch(`/datasets/${id}/download`, { token });

      if (!upstream.ok) {
        const body = await upstream.json().catch(() => ({}));
        return NextResponse.json(
          { message: body?.detail ?? "Download failed" },
          { status: upstream.status }
        );
      }

      // Stream the file back with the correct headers
      const contentDisposition =
        upstream.headers.get("content-disposition") ??
        `attachment; filename="dataset_${id}_processed.jsonl"`;

      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson",
          "Content-Disposition": contentDisposition,
        },
      });
    } catch (err) {
      if (err instanceof BackendError)
        return NextResponse.json({ message: err.message }, { status: err.status });
      return NextResponse.json({ message: "Download failed" }, { status: 500 });
    }
  }

  // GET /api/datasets/[id] — fetch single dataset detail
  try {
    const upstream = await backendFetch(`/datasets/${id}`, { token });
    const data = await upstream.json();
    if (!upstream.ok)
      return NextResponse.json({ message: data?.detail ?? "Not found" }, { status: upstream.status });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to fetch dataset" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const res = await backendFetch(`/datasets/${id}`, { method: "DELETE", token });

    if (res.status === 404)
      return NextResponse.json({ message: "Dataset not found." }, { status: 404 });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: body?.detail ?? body?.message ?? "Delete failed" },
        { status: res.status }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof BackendError)
      return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to delete dataset" }, { status: 500 });
  }
}