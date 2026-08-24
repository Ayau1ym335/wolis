

import { apiRequest, AI_TIMEOUT_MS } from "./apiClient";

export interface GenerateReportResponse {
  download_url: string;
}


export async function generateReport(sessionId: string): Promise<GenerateReportResponse> {
  return apiRequest<GenerateReportResponse>(
    `/measurements/${sessionId}/report`,
    { method: "POST", timeoutMs: AI_TIMEOUT_MS }
  );
}
