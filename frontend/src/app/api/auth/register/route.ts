import { NextRequest, NextResponse } from "next/server";
import { backendFetchJson, BackendError } from "@/lib/api/backend";
import type { UserCreate, UserResponse } from "@/types/api";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UserCreate;

  try {
    const user = await backendFetchJson<UserResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json(
        { message: err.message, fieldErrors: err.fieldErrors },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { message: "Unexpected error during registration" },
      { status: 500 }
    );
  }
}
