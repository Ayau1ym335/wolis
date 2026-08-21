export const env = {
  API_BASE_URL: process.env.WOLIS_API_BASE_URL ?? "http://localhost:8000",
  USE_MOCK_BLE: (process.env.WOLIS_USE_MOCK_BLE ?? "true") === "true",
};