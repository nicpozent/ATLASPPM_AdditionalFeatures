import "./fonts/fonts.css"; // self-hosted webfonts (no external CDN) — ADR-0078
import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { RoleProvider } from "@/components/RoleContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { AuthProvider } from "@/components/AuthContext";
import { I18nProvider } from "@/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster, toastError } from "@/components/Toast";
import { ApiError } from "@/api";
import { msal, handleRedirect, resolveApiRoles } from "./auth";

// Global resets (kept minimal; screens style inline to match the prototype).
const reset = document.createElement("style");
reset.textContent = `
  *{box-sizing:border-box;}
  html,body,#root{margin:0;padding:0;height:100%;}
  body{font-family:'Public Sans',-apple-system,sans-serif;color:var(--atlas-text,#181B2A);background:var(--atlas-bg,#EEF1F6);-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:10px;height:10px;}
  ::-webkit-scrollbar-thumb{background:var(--atlas-border2,#C7CEDB);border-radius:6px;border:2px solid transparent;background-clip:content-box;}
  a{color:inherit;}
`;
document.head.appendChild(reset);

// Surface failed writes (e.g. a permission-matrix 403) as a toast instead of
// failing silently. Mutations may still opt into their own handling.
const qc: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    // Failed writes surface as a friendly toast (incl. the support code on 5xx).
    onError: (err) => toastError(err),
    // Any successful write may have produced an audit entry — keep the log fresh.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["audit"] }); },
  }),
  queryCache: new QueryCache({
    // Only surface unexpected server failures on reads; 4xx (and endpoints that
    // catch their own errors into empty states) stay quiet to avoid noise.
    onError: (err) => { if (err instanceof ApiError && err.status >= 500) toastError(err); },
  }),
});

async function boot() {
  if (msal) {
    await msal.initialize();
    await handleRedirect();   // completes a redirect sign-in and sets the active account
    await resolveApiRoles();  // decode app roles from the API access token before first render
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <AuthProvider>
            <RoleProvider>
              <ThemeProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
                <Toaster />
              </ThemeProvider>
            </RoleProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

boot();
