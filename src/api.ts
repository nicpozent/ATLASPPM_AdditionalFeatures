// ============================================================================
//  Typed API client. Same-origin in prod (nginx proxies /api → API); dev uses
//  the Vite proxy. Attaches the Entra bearer token when auth is enabled.
//  Add typed endpoint helpers here as each screen is wired to the API.
// ============================================================================
import { getToken } from "./auth";

const BASE = (import.meta.env.VITE_API_BASE as string) || "/api/v1";

// The selected role (cosmetic switcher, persisted by RoleContext). When auth is
// OFF the API reads this header so the demo can show real permission enforcement;
// when auth is ON the server ignores it and trusts the Entra token instead.
function roleHeader(): Record<string, string> {
  try {
    const r = localStorage.getItem("atlas.role");
    return r ? { "X-Atlas-Role": r } : {};
  } catch {
    return {};
  }
}

// A failed API call. Carries the server's friendly message plus, for unexpected
// (5xx) failures, the correlation code the request logger stamped — so the UI can
// show it and deep-link to the matching troubleshooting entry.
export class ApiError extends Error {
  status: number;
  errorId?: string;
  category?: string;
  constructor(message: string, status: number, errorId?: string, category?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorId = errorId;
    this.category = category;
  }
}

// Reads a server-provided { error, errorId, category } from a failed response so
// callers can show why it failed (a 403 message, or a 5xx with its support code).
async function errorFrom(res: Response): Promise<ApiError> {
  let message = `API ${res.status} ${res.statusText}`;
  let errorId: string | undefined;
  let category: string | undefined;
  try {
    const body = await res.clone().json();
    if (body && typeof body.error === "string") message = body.error;
    if (body && typeof body.errorId === "string") errorId = body.errorId;
    if (body && typeof body.category === "string") category = body.category;
  } catch { /* not JSON — keep the status line */ }
  return new ApiError(message, res.status, errorId, category);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...roleHeader(),
      ...init.headers,
    },
  });
  if (!res.ok) throw await errorFrom(res);
  return res.status === 204 ? null : ((await res.json()) as T);
}

// Multipart upload (files). Attaches the bearer token but lets the browser set
// the multipart boundary — so we don't force a JSON Content-Type here.
export async function apiUpload<T>(path: string, form: FormData): Promise<T | null> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...roleHeader() },
    body: form,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.status === 204 ? null : ((await res.json()) as T);
}

// Authenticated file download — fetches with the bearer token (a plain <a href>
// wouldn't carry it) and triggers a browser download of the returned blob.
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...roleHeader() },
  });
  if (!res.ok) throw await errorFrom(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Example (extend per feature — see CLAUDE.md § Data & API):
// export interface Project { id: string; code: string; name: string; /* ... */ }
// export const getProjects = () => api<Project[]>("/projects");
