/**
 * services/apiClient.ts
 *
 * TASK 36 update: added setAuthToken() / getAuthToken() so that
 * useAuth can inject the Supabase JWT once after login, and every
 * subsequent apiRequest() sends it automatically.
 *
 * The token lives in a module-level variable (effectively a singleton
 * for the process lifetime).  This is intentional: React Native runs
 * in a single JS context so there's no multi-tenant concern, and
 * it avoids threading the token through every call site.
 *
 * TASK 29 original contract (apiRequest signature) is unchanged.
 */

import { env } from "../config/env";
import type { ApiErrorBody } from "../types/wolis";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    public readonly body: ApiErrorBody
  ) {
    super(`API error ${status}: ${errorCode}`);
    this.name = "ApiError";
  }
}

// ─── Auth token store ─────────────────────────────────────────────────────────

let _authToken: string | null = null;

/**
 * Called by useAuth after a successful sign-in or session restore.
 * Pass null to clear (on sign-out).
 */
export function setAuthToken(token: string | null): void {
  _authToken = token;
}

/** Returns the currently stored token, or null if not authenticated. */
export function getAuthToken(): string | null {
  return _authToken;
}

// ─── Request helper ───────────────────────────────────────────────────────────

interface ApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
  /** Override token for this request only (e.g. for auth endpoints). */
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const token = options.token !== undefined ? options.token : _authToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${env.API_BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(0, "network_error", { error: "network_error" });
  }

  if (response.status === 401) {
    let errorBody: any = { error: "unauthorized" };
    try {
      errorBody = await response.json();
      console.error("[apiClient] 401 Unauthorized details:", JSON.stringify(errorBody, null, 2));
    } catch {
      console.error("[apiClient] 401 Unauthorized (no JSON body)");
    }
    // Surface auth errors as a dedicated code so callers (e.g. WolisNavigator)
    // can redirect to the login screen rather than showing a generic error.
    // Ensure we pass the actual backend message if it exists (FastAPI puts it in 'detail.message' or similar)
    const backendMessage = errorBody?.detail?.message || errorBody?.message || "unauthorized";
    throw new ApiError(401, "unauthorized", { error: "unauthorized", message: backendMessage });
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = { error: "unknown_error" };
    }
    throw new ApiError(response.status, body.error ?? "unknown_error", body);
  }

  return response.json() as Promise<T>;
}
