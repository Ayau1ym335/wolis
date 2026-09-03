

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



let _authToken: string | null = null;


export function setAuthToken(token: string | null): void {
  _authToken = token;
}


export function getAuthToken(): string | null {
  return _authToken;
}



interface ApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
  
  token?: string | null;
  
  timeoutMs?: number;
}


export const AI_TIMEOUT_MS = 90_000;

const DEFAULT_TIMEOUT_MS = 30_000;

export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const token = options.token !== undefined ? options.token : _authToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${env.API_BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (networkError) {
    const realMessage = (networkError as Error)?.message ?? String(networkError);
    console.error("[apiClient] fetch failed:", realMessage, networkError);
    if ((networkError as Error)?.name === "AbortError") {
      throw new ApiError(0, "timeout", { error: "timeout", message: "Превышено время ожидания запроса" });
    }
    throw new ApiError(0, "network_error", { error: "network_error", message: `Сетевая ошибка: ${realMessage}` });
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    let errorBody: any = { error: "unauthorized" };
    try {
      errorBody = await response.json();
      console.error("[apiClient] 401 Unauthorized details:", JSON.stringify(errorBody, null, 2));
    } catch {
      console.error("[apiClient] 401 Unauthorized (no JSON body)");
    }
    
    
    
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
