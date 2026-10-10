import { env } from "../env";
import { ApiError } from "./types";

function buildUrl(path: string) {
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function friendlyMessage(code: number, fallback: string) {
  switch (code) {
    case 10001:
      return "Incorrect email or password";
    case 10002:
      return "Your login has expired. Please log in again";
    case 10003:
      return "There is no permission to access this resource\n";
    case 20001:
      return "There is an error in the input. Please check it before submitting";
    case 20004:
      return "No relevant data was found.";
    case 30001:
      return "Insufficient points";
    case 30002:
      return "Operation conflict or repetitive operation";
    case 90001:
      return "An internal server error. Please try again later";
    default:
      return fallback;
  }
}

export async function apiRequest<T>(args: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
}) {
  const { path, method = "GET", token, body } = args;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let resp: Awaited<ReturnType<typeof fetch>>;
  try {
    resp = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error: Unable to connect to the server. Please check API_BASE_URL and whether the backend service is started");
  }

  let json: { code?: unknown; message?: unknown; data?: unknown };
  try {
    json = (await resp.json()) as { code?: unknown; message?: unknown; data?: unknown };
  } catch {
    throw new ApiError(-1, "The server response is abnormal. Please try again later\n" , null);
  }
  if (typeof json?.code !== "number") {
    throw new ApiError(-1, "invalid response", json);
  }
  if (json.code !== 0) {
    const raw = typeof json.message === "string" && json.message ? json.message : "request failed";
    throw new ApiError(json.code, friendlyMessage(json.code, raw), json.data ?? null);
  }
  return json.data as T;
}
