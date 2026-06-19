export class ClientApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
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
      const body = await res.json();
      message = body?.message ?? message;
      fieldErrors = body?.fieldErrors;
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
