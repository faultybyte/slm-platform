import "server-only";

import { API_URL } from "@/lib/config";
import type { HTTPValidationError } from "@/types/api";

export class BackendError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function flattenValidationError(body: HTTPValidationError): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const item of body.detail ?? []) {
    const field = item.loc[item.loc.length - 1];
    if (typeof field === "string") {
      fieldErrors[field] = item.msg;
    }
  }
  const message = body.detail?.[0]?.msg ?? "Validation failed";
  return { message, fieldErrors };
}

/**
 * Server-side fetch wrapper for the FastAPI backend.
 * - Resolves relative paths against API_URL (never exposed to the client).
 * - Normalizes 422 responses into BackendError with per-field messages.
 * - Pass `token` to attach an Authorization header for HTTPBearer-secured routes.
 */
export async function backendFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    cache: "no-store",
  });

  return res;
}

/**
 * Same as backendFetch, but throws BackendError on non-2xx responses and
 * returns parsed JSON on success. Use this for the common case; use
 * backendFetch directly when you need to stream the response body.
 */
export async function backendFetchJson<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const res = await backendFetch(path, options);

  if (res.status === 422) {
    const body = (await res.json()) as HTTPValidationError;
    const { message, fieldErrors } = flattenValidationError(body);
    throw new BackendError(422, message, fieldErrors);
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail ?? body?.message ?? message;
    } catch {
      // body wasn't JSON, keep default message
    }
    throw new BackendError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
