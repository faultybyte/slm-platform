import { NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

/**
 * Proxies a simple authenticated GET request from a Next.js route handler
 * to the FastAPI backend, attaching the bearer token from the session
 * cookie. Use directly inside `export async function GET() { ... }`.
 */
export async function proxyAuthenticatedGet<T>(backendPath: string) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const data = await backendFetchJson<T>(backendPath, { token });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    return NextResponse.json({ message: "Unexpected error" }, { status: 500 });
  }
}
