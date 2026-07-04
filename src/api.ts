// ============================================================================
//  Typed API client. Same-origin in prod (nginx proxies /api → API); dev uses
//  the Vite proxy. Attaches the Entra bearer token when auth is enabled.
//  Add typed endpoint helpers here as Claude Code wires each screen to the API.
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

// Reads a server-provided { error } message from a failed response so callers
// (e.g. a 403 from the permission matrix) can show why the action was refused.
async function errorFrom(res: Response): Promise<Error> {
  try {
    const body = await res.clone().json();
    if (body && typeof body.error === "string") return new Error(body.error);
  } catch { /* not JSON — fall through */ }
  return new Error(`API ${res.status} ${res.statusText}`);
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
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
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
