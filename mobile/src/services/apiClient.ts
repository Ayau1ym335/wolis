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

interface ApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.API_BASE_URL}${path}`, {
      method: options.method,
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(0, "network_error", { error: "network_error" });
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
