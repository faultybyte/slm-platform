export class ClientApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValidationError(error: unknown) {
  if (!isRecord(error)) return "Validation error";
  const loc = Array.isArray(error.loc) ? error.loc.join(".") : "field";
  const msg = typeof error.msg === "string" ? error.msg : "Invalid value";
  return `${loc}: ${msg}`;
}

/**
 * Calls our own /api/* route handlers (never the FastAPI backend directly —
 * that base URL is server-only). Throws ClientApiError on non-2xx so React
 * Query's onError / isError paths work without extra parsing at call sites.
 */
export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    let fieldErrors: Record<string, string> | undefined;
    try {
      const body: unknown = await res.json();
      const parsedBody = isRecord(body) ? body : {};
      // FastAPI returns validation errors in 'detail' field
      if (Array.isArray(parsedBody.detail)) {
        const errors = parsedBody.detail.map(formatValidationError).join("; ");
        message = `Validation error: ${errors}`;
      } else if (typeof parsedBody.detail === "string") {
        message = parsedBody.detail;
      } else {
        message = typeof parsedBody.message === "string" ? parsedBody.message : message;
      }
      fieldErrors = isRecord(parsedBody.fieldErrors)
        ? Object.fromEntries(
            Object.entries(parsedBody.fieldErrors).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined;
    } catch {
      // ignore parse failure, keep default message
    }
    throw new ClientApiError(res.status, message, fieldErrors);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
