import { API_URL } from "@/constants/config";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/storage";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  const firstKey = Object.keys(record)[0];
  const val = record[firstKey];
  if (Array.isArray(val) && val[0]) return String(val[0]);
  if (typeof val === "string") return val;
  return fallback;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_URL}/auth/refresh/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const data = (await res.json()) as { access: string; refresh?: string };
  if (data.refresh) {
    await setTokens(data.access, data.refresh);
  } else {
    const existingRefresh = await getRefreshToken();
    if (existingRefresh) await setTokens(data.access, existingRefresh);
  }
  return data.access;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const access = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      return apiRequest<T>(path, options, false);
    }
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  const contentType = res.headers.get("content-type");
  const body =
    contentType?.includes("application/json")
      ? await res.json()
      : await res.text();

  if (!res.ok) {
    throw new ApiError(
      extractErrorMessage(body, `Request failed (${res.status})`),
      res.status,
      body
    );
  }

  return body as T;
}

export async function publicRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      extractErrorMessage(body, `Request failed (${res.status})`),
      res.status,
      body
    );
  }
  return body as T;
}
