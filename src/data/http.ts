import { API_BASE } from "./api";

export function getToken(): string {
  return localStorage.getItem("examshield_token") || "";
}

export async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.clone().json();
    if (j && typeof j === "object") {
      if (j.detail) return j.detail;
      const parts = Object.entries(j).map(([k, v]) =>
        `${k}: ${Array.isArray(v) ? v.join(", ") : v}`
      );
      if (parts.length) return parts.join(" | ");
    }
  } catch {}
  return `${fallback} (HTTP ${res.status})`;
}

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${getToken()}`,
  };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export async function apiPost<T = unknown>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await parseApiError(res, fallback));
  return res.json();
}

export async function apiPut<T = unknown>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await authFetch(path, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await parseApiError(res, fallback));
  return res.json();
}

export async function apiDelete(path: string, fallback: string): Promise<void> {
  const res = await authFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseApiError(res, fallback));
}
