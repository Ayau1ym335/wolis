/**
 * services/reportsApi.ts
 *
 * TASK 39 — Client for POST /measurements/{session_id}/report.
 *
 * The backend generates the PDF, uploads it to Supabase Storage, and
 * returns a public download URL.  This module wraps that one call.
 */

import { apiRequest, AI_TIMEOUT_MS } from "./apiClient";

export interface GenerateReportResponse {
  download_url: string;
}

/**
 * Ask the backend to (re-)generate a PDF report for a session.
 * Returns the public download URL from Supabase Storage.
 *
 * The endpoint is idempotent — calling again with the same session_id
 * overwrites the previous file and returns a fresh URL.
 */
export async function generateReport(sessionId: string): Promise<GenerateReportResponse> {
  return apiRequest<GenerateReportResponse>(
    `/measurements/${sessionId}/report`,
    { method: "POST", timeoutMs: AI_TIMEOUT_MS }
  );
}
