// ============================================================================
//  Typed API client. Same-origin in prod (nginx proxies /api → API); dev uses
//  the Vite proxy. Attaches the Entra bearer token when auth is enabled.
//  Add typed endpoint helpers here as Claude Code wires each screen to the API.
// ============================================================================
import { getToken } from "./auth";

const BASE = (import.meta.env.VITE_API_BASE as string) || "/api/v1";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status} ${res.statusText}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

// Example (extend per feature — see CLAUDE.md § Data & API):
// export interface Project { id: string; code: string; name: string; /* ... */ }
// export const getProjects = () => api<Project[]>("/projects");
