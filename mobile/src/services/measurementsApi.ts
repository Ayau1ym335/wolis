import { apiRequest } from "./apiClient";
import type {
  CreateMeasurementPayload,
  CreateMeasurementResponse,
  MeasurementSummary,
  WolisResult,
} from "../types/wolis";

export async function createMeasurement(
  payload: CreateMeasurementPayload
): Promise<CreateMeasurementResponse> {
  return apiRequest<CreateMeasurementResponse>("/measurements", {
    method: "POST",
    body: payload,
  });
}

export async function assessMeasurement(sessionId: string): Promise<WolisResult> {
  return apiRequest<WolisResult>(`/measurements/${sessionId}/assess`, {
    method: "POST",
  });
}

export async function submit(payload: CreateMeasurementPayload): Promise<WolisResult> {
  const { session_id } = await createMeasurement(payload);
  return assessMeasurement(session_id);
}

/** Fetch the current user's past measurement sessions, newest first. */
export async function getHistory(): Promise<MeasurementSummary[]> {
  return apiRequest<MeasurementSummary[]>("/measurements", { method: "GET" });
}

/** Re-fetch the full result (assessment + solutions) for a specific session. */
export async function getSessionResult(sessionId: string): Promise<WolisResult> {
  return apiRequest<WolisResult>(`/measurements/${sessionId}/result`, { method: "GET" });
}
