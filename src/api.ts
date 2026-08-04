// ============================================================================
//  Typed API client. Same-origin in prod (nginx proxies /api → API); dev uses
//  the Vite proxy. Attaches the Entra bearer token when auth is enabled.
//  Add typed endpoint helpers here as each screen is wired to the API.
// ============================================================================
import { getToken } from "./auth";
import type { components } from "./api/generated";

// The generated API contract. `src/api/generated.ts` is produced from the
// server's OpenAPI document by `npm run api:types` (openapi-typescript), and a
// CI drift check regenerates it and fails on any diff — so these types can't
// silently fall out of step with the backend DTOs. Import request/response
// shapes from here instead of re-declaring them by hand:
//   import type { Schemas } from "@/api";
//   type Capacity = Schemas["CapacityDto"];
// Caveat: only endpoints that DECLARE their response (`TypedResults` or
// `.Produces<T>()`) publish a response schema; handlers returning `Results.Ok`
// erase it. Adopt per screen by adding `.Produces<T>()` server-side as you go —
// see ADR-0081 and CLAUDE.md §6.
export type Schemas = components["schemas"];

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

// A network-level failure — API down, DNS failure, offline, CORS — makes fetch
// reject with a TypeError, which is NOT an ApiError, so the global query handler
// (and the UI) can't tell it apart from a legitimate empty result and the app
// renders as a healthy, empty portfolio. Translate it to an ApiError with status
// 0 so it surfaces as a real error, not "no data".
async function doFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Can’t reach the Atlas API — check your connection and try again.", 0);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await getToken();
  const res = await doFetch(path, {
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
  const res = await doFetch(path, {
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
  const res = await doFetch(path, {
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
