import { NextRequest, NextResponse } from "next/server";
import { backendFetch, backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  const body = await req.json();

  try {
    const res = await backendFetch(`/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      token,
    });

    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return NextResponse.json({ message: b?.detail ?? b?.message ?? "Update failed" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendError) return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to update conversation" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const res = await backendFetch(`/conversations/${id}`, { method: "DELETE", token });
    if (res.status === 404) return NextResponse.json({ message: "Not found" }, { status: 404 });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return NextResponse.json({ message: b?.detail ?? b?.message ?? "Delete failed" }, { status: res.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof BackendError) return NextResponse.json({ message: err.message }, { status: err.status });
    return NextResponse.json({ message: "Failed to delete conversation" }, { status: 500 });
  }
}
