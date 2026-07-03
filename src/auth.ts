// ============================================================================
//  Auth — Microsoft Entra ID via MSAL (browser, PKCE).
//  Disabled by default (VITE_AUTH_ENABLED=false) so the UI runs with no backend.
//  Turn it on + fill the env vars to wire real SSO. Access tokens are kept in
//  memory (not localStorage) to reduce XSS token-theft risk.
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
      cache: { cacheLocation: "memoryStorage" },
    })
  : null;

// Scope requested for the Atlas API access token.
const API_SCOPE = `${import.meta.env.VITE_API_AUDIENCE}/.default`;
// Scopes for the initial interactive sign-in (identity + the API).
const LOGIN_SCOPES = ["openid", "profile", "email", API_SCOPE];

export interface AuthUser { name: string; username: string; initials: string; }

function toUser(a: AccountInfo): AuthUser {
  const name = a.name || a.username;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return { name, username: a.username, initials };
}

// The signed-in account, if any. MSAL keeps this in memory only (see cache above).
export function currentUser(): AuthUser | null {
  if (!msal) return null;
  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  return account ? toUser(account) : null;
}

// Completes a redirect sign-in (call once on boot) and sets the active account.
export async function handleRedirect(): Promise<void> {
  if (!msal) return;
  const result = await msal.handleRedirectPromise();
  if (result?.account) msal.setActiveAccount(result.account);
  else if (!msal.getActiveAccount()) {
    const existing = msal.getAllAccounts()[0];
    if (existing) msal.setActiveAccount(existing);
  }
}

export function login(): void {
  void msal?.loginRedirect({ scopes: LOGIN_SCOPES });
}

export function logout(): void {
  const account = msal?.getActiveAccount() ?? undefined;
  void msal?.logoutRedirect({ account, postLogoutRedirectUri: window.location.origin });
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
