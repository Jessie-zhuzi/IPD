export const env = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000",
} as const;

