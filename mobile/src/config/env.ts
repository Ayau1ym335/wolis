/**
 * config/env.ts
 *
 * All environment-specific values in one place.
 * TASK 36: added SUPABASE_URL and SUPABASE_ANON_KEY for the Auth client.
 */
export const env = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || "https://wolis.onrender.com",
  USE_MOCK_BLE: (process.env.EXPO_PUBLIC_USE_MOCK_BLE || "true") === "true",
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://eqminpgmdjpzytuzfbyn.supabase.co",
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbWlucGdtZGpwenl0dXpmYnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzQzNTUsImV4cCI6MjEwMjYxMDM1NX0.RRU-EiZunwTKjNK0pczsEPByHVkQs1pInBA74XFm25c",
};