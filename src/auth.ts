// ============================================================================
//  Auth — Microsoft Entra ID via MSAL (browser, PKCE).
//  Disabled by default (VITE_AUTH_ENABLED=false) so the UI runs with no backend.
//  Turn it on + fill the env vars to wire real SSO. Tokens live in
//  sessionStorage: cleared when the tab closes, and — unlike memoryStorage —
//  they survive the full-page navigation that the redirect sign-in flow needs.
// ============================================================================
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from "@azure/msal-browser";

export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";

export const msal = AUTH_ENABLED
  ? new PublicClientApplication({
      auth: {
        clientId: import.meta.env.VITE_AUTH_CLIENT_ID as string,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AUTH_TENANT_ID}`,
        redirectUri: window.location.origin,
      },
      // sessionStorage (not memoryStorage): the redirect flow navigates away to
      // Entra and back, and the in-flight request state must survive that.
      cache: { cacheLocation: "sessionStorage" },
    })
  : null;

// Scope requested for the Atlas API access token. Defaults to `/.default`;
// for a single app registration that exposes its own API, set VITE_API_SCOPE to
// a named scope (e.g. "access_as_user") and VITE_API_AUDIENCE to the app's GUID
// — requesting `api://<self>/.default` is rejected by Entra (AADSTS90009).
const API_SCOPE = `${import.meta.env.VITE_API_AUDIENCE}/${(import.meta.env.VITE_API_SCOPE as string) || ".default"}`;
// Scopes for the initial interactive sign-in (identity + the API).
const LOGIN_SCOPES = ["openid", "profile", "email", API_SCOPE];

export interface AuthUser { name: string; username: string; initials: string; role: string; }

// Entra app roles (see CLAUDE.md §7) → the cosmetic UI identity used by the
// role switcher/nav. The API stays authoritative from the token; this only
// drives which identity + nav the signed-in user lands on.
const ENTRA_TO_UI: Record<string, string> = {
  PlatformAdmin: "admin", PMO: "pmo", ProjectManager: "pm",
  TeamMember: "teammgr", Executive: "pmo", Stakeholder: "stakeholder",
};
const ROLE_PRIORITY = ["admin", "pmo", "pm", "teammgr", "stakeholder"];

function roleFromClaims(a: AccountInfo): string {
  const claims = a.idTokenClaims as { roles?: string[] } | undefined;
  const mapped = (claims?.roles ?? []).map((r) => ENTRA_TO_UI[r]).filter(Boolean);
  // Highest-privilege wins when a user carries several app roles.
  return ROLE_PRIORITY.find((p) => mapped.includes(p)) ?? "";
}

function toUser(a: AccountInfo): AuthUser {
  const name = a.name || a.username;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return { name, username: a.username, initials, role: roleFromClaims(a) };
}

// The signed-in account, if any.
export function currentUser(): AuthUser | null {
  if (!msal) return null;
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  return account ? toUser(account) : null;
}

// Completes a redirect sign-in (call once on boot) and sets the active account.
export async function handleRedirect(): Promise<void> {
  if (!msal) return;
  try {
    const result = await msal.handleRedirectPromise();
    if (result?.account) msal.setActiveAccount(result.account);
    else if (!msal.getActiveAccount()) {
      const existing = msal.getAllAccounts()[0];
      if (existing) msal.setActiveAccount(existing);
    }
  } catch (e) {
    console.error("[auth] completing sign-in failed:", e);
  }
}

export function login(): void {
  // Surface failures — a silent catch here is why a dead "Sign in" button is
  // so hard to debug. loginRedirect navigates away on success.
  msal?.loginRedirect({ scopes: LOGIN_SCOPES }).catch((e) =>
    console.error("[auth] sign-in failed:", e));
}

export function logout(): void {
  const account = msal?.getActiveAccount() ?? undefined;
  msal?.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin }).catch((e) =>
    console.error("[auth] sign-out failed:", e));
}

// Acquires an API access token silently, falling back to an interactive
// redirect when Entra requires re-consent / re-auth.
export async function getToken(): Promise<string | undefined> {
  if (!msal) return undefined;
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0];
  if (!account) return undefined;
  try {
    const res = await msal.acquireTokenSilent({ scopes: [API_SCOPE], account });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ scopes: [API_SCOPE], account });
    }
    return undefined;
  }
}
