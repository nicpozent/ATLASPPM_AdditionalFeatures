import React from "react";
import ReactDOM from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { RoleProvider } from "@/components/RoleContext";
import { AuthProvider } from "@/components/AuthContext";
import { Toaster, toast } from "@/components/Toast";
import { msal, handleRedirect } from "./auth";

// Global resets (kept minimal; screens style inline to match the prototype).
const reset = document.createElement("style");
reset.textContent = `
  *{box-sizing:border-box;}
  html,body,#root{margin:0;padding:0;height:100%;}
  body{font-family:'Public Sans',-apple-system,sans-serif;color:#181B2A;background:#EEF1F6;-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:10px;height:10px;}
  ::-webkit-scrollbar-thumb{background:#C7CEDB;border-radius:6px;border:2px solid transparent;background-clip:content-box;}
  a{color:inherit;}
`;
document.head.appendChild(reset);

// Surface failed writes (e.g. a permission-matrix 403) as a toast instead of
// failing silently. Mutations may still opt into their own handling.
const qc = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err) => toast(err instanceof Error ? err.message : "Something went wrong.", "error"),
  }),
});

async function boot() {
  if (msal) {
    await msal.initialize();
    await handleRedirect(); // completes a redirect sign-in and sets the active account
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <RoleProvider>
            <App />
            <Toaster />
          </RoleProvider>
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

boot();
