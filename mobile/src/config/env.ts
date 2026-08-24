export const env = {
  API_BASE_URL: "https://wolis.onrender.com",
  USE_MOCK_BLE: true,
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
};