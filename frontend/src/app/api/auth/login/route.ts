import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import { setSessionCookie } from "@/lib/api/session";
import type { UserCreate, Token } from "@/types/api";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UserCreate;

  try {
    const token = await backendFetchJson<Token>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await setSessionCookie(token.access_token);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json(
        { message: err.message, fieldErrors: err.fieldErrors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { message: "Unexpected error during login" },
      { status: 500 }
    );
  }
}
