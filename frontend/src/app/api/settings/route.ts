import { NextRequest, NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const res = await backendFetch("/settings/", { token });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const res = await backendFetch("/settings/", {
      method: "PUT",
      token,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}
