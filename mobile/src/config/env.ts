export const env = {
  API_BASE_URL: "https://wolis.onrender.com",
  // Set EXPO_PUBLIC_USE_MOCK_BLE=true in .env for web / Expo Go dev without hardware
  USE_MOCK_BLE: process.env.EXPO_PUBLIC_USE_MOCK_BLE === "true",
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string,
};