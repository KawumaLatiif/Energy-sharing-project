const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("gpawa_admin_token");
}

export class ApiError extends Error {
  response: { data: any; status: number };
  constructor(status: number, data: any) {
    super(data?.detail ?? "Request failed");
    this.response = { data, status };
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<{ data: T }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = {};
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    // Only redirect to login if the token has expired (i.e. we were already authenticated).
    // During login itself there is no token, so we just surface the error.
    if (res.status === 401 && getToken()) {
      localStorage.removeItem("gpawa_admin_token");
      localStorage.removeItem("gpawa_admin_role");
      window.location.href = "/login";
    }
    throw new ApiError(res.status, data);
  }

  return { data };
}

export const api = {
  get:    <T = any>(path: string)                  => request<T>("GET",    path),
  post:   <T = any>(path: string, body?: unknown)  => request<T>("POST",   path, body),
  patch:  <T = any>(path: string, body?: unknown)  => request<T>("PATCH",  path, body),
  delete: <T = any>(path: string)                  => request<T>("DELETE", path),
};

export async function downloadCsv(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function openPdf(path: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Could not load document");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatUGX(amount: number, currency = "UGX"): string {
  return `${currency} ${amount.toLocaleString()}`;
}
