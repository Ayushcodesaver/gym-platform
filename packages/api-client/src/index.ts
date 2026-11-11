import type { ApiResponse } from "@gym/types";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type TokenGetter = () => Promise<string | null>;

/**
 * Shared client for web + mobile. Every request carries the Clerk session token;
 * the backend derives identity — no client-provided user/gym/role fields.
 */
export function createApiClient(baseUrl: string, getToken: TokenGetter) {
  async function request<T>(
    path: string,
    init: Omit<RequestInit, "body"> & { body?: unknown } = {},
  ): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      body: (init.body !== undefined ? JSON.stringify(init.body) : undefined) as RequestInit["body"],
    });

    let json: ApiResponse<T> | null = null;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new ApiClientError("NETWORK_ERROR", "Unexpected server response", res.status);
    }

    if (!res.ok || !json || json.success === false) {
      const err = json && json.success === false ? json.error : null;
      throw new ApiClientError(
        err?.code ?? "EXTERNAL_SERVICE_ERROR",
        err?.message ?? "Request failed",
        res.status,
      );
    }
    return json.data;
  }

  return {
    get: <T,>(path: string) => request<T>(path),
    post: <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
    patch: <T,>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
