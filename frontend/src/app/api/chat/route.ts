import { backendFetch } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

export async function POST(req: Request) {
  try {
    const token = await getSessionToken();

    if (!token) {
      return Response.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const backendRes = await backendFetch("/v1/chat/completions", {
      method: "POST",
      token,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text().catch(() => "");
      return Response.json(
        {
          message: errorText || "Chat request failed",
        },
        {
          status: backendRes.status,
        }
      );
    }

    if (!backendRes.body) {
      return Response.json(
        { message: "No stream returned from backend" },
        { status: 502 }
      );
    }

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: {
        "Content-Type":
          backendRes.headers.get("content-type") ??
          "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        message: "Internal server error",
      },
      {
        status: 500,
      }
    );
  }
}