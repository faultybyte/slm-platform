import { backendFetch } from "@/lib/api/backend";
import { getSessionToken } from "@/lib/api/session";

function resolveConversationId(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("conversationId") ?? "1";
  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function POST(req: Request) {
  try {
    const token = await getSessionToken();

    if (!token) {
      return Response.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json(
        { message: "Missing file field" },
        { status: 400 }
      );
    }

    const conversationId = resolveConversationId(req);

    const backendRes = await backendFetch(
      `/conversations/${conversationId}/documents`,
      {
        method: "POST",
        token,
        body: formData,
      }
    );

    if (!backendRes.ok) {
      const errorText = await backendRes.text().catch(() => "");
      return Response.json(
        {
          message: errorText || "Upload failed",
        },
        {
          status: backendRes.status,
        }
      );
    }

    if (!backendRes.body) {
      return Response.json(
        { message: "Upload completed" },
        { status: backendRes.status }
      );
    }

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: {
        "Content-Type":
          backendRes.headers.get("content-type") ??
          "application/json",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        message: "Upload failed",
      },
      {
        status: 500,
      }
    );
  }
}