// ============================================================================
//  Auth — Microsoft Entra ID via MSAL (browser, PKCE).
//  Disabled by default (VITE_AUTH_ENABLED=false) so the UI runs with no backend.
//  Turn it on + fill the env vars to wire real SSO. Access tokens are kept in
//  memory (not localStorage) to reduce XSS token-theft risk.
// ============================================================================
import { PublicClientApplication } from "@azure/msal-browser";

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

const SCOPE = `${import.meta.env.VITE_API_AUDIENCE}/.default`;

export async function getToken(): Promise<string | undefined> {
  if (!msal) return undefined;
  const account = msal.getAllAccounts()[0];
  if (!account) return undefined;
  const res = await msal.acquireTokenSilent({ scopes: [SCOPE], account });
  return res.accessToken;
}
