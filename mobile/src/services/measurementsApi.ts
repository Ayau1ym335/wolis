import { apiRequest, AI_TIMEOUT_MS } from "./apiClient";
import type {
  CreateMeasurementPayload,
  CreateMeasurementResponse,
  MeasurementSummary,
  WolisResult,
} from "../types/wolis";

export async function createMeasurement(
  payload: CreateMeasurementPayload
): Promise<CreateMeasurementResponse> {
  // Backend expects a nested structure: { sensor_data: {...}, building_context: {...} }
  // But the mobile app builds a flat payload, so we transform it here.
  const body = {
    sensor_data: {
      temperature_c: payload.temperature_c,
      humidity_pct: payload.humidity_pct,
      pressure_hpa: payload.pressure_hpa,
      illuminance_lux: payload.illuminance_lux,
      tilt_angle_deg: payload.tilt_angle_deg,
      vibration_magnitude: payload.vibration_magnitude,
      shock_detected: payload.shock_detected,
    },
    building_context: {
      building_type: payload.building_type,
      age_years: payload.age_years,
      material: payload.material,
      area_m2: payload.area_m2,
      region: payload.region,
    },
  };
  return apiRequest<CreateMeasurementResponse>("/measurements", {
    method: "POST",
    body,
  });
}

export async function assessMeasurement(sessionId: string): Promise<WolisResult> {
  return apiRequest<WolisResult>(`/measurements/${sessionId}/assess`, {
    method: "POST",
    timeoutMs: AI_TIMEOUT_MS,
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
