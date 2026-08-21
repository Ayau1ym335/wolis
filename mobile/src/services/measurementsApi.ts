import { apiRequest } from "./apiClient";
import type { CreateMeasurementPayload, CreateMeasurementResponse, WolisResult } from "../types/wolis";

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
