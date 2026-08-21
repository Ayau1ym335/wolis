/**
 * config/env.ts
 *
 * All environment-specific values in one place.
 * TASK 36: added SUPABASE_URL and SUPABASE_ANON_KEY for the Auth client.
 */
export const env = {
  API_BASE_URL: process.env.WOLIS_API_BASE_URL ?? "http://localhost:8000",
  USE_MOCK_BLE: (process.env.WOLIS_USE_MOCK_BLE ?? "true") === "true",
  /** Supabase project URL — e.g. https://xyzxyz.supabase.co */
  SUPABASE_URL: process.env.WOLIS_SUPABASE_URL ?? "",
  /** Supabase anon (public) key — safe to ship in client bundle */
  SUPABASE_ANON_KEY: process.env.WOLIS_SUPABASE_ANON_KEY ?? "",
};