import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dev server proxies /api to the backend so the SPA is same-origin in dev too.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the big, rarely-changing vendor libraries into their own chunks
        // so they cache independently of app code and don't bloat the entry
        // bundle. Route screens are already split via React.lazy (see App.tsx).
        // Vite 8 (Rolldown) takes `manualChunks` as a function, not an object.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@azure/msal")) return "vendor-msal";
          if (
            /node_modules[\\/](react|react-dom|react-router|react-router-dom|@remix-run[\\/]router|scheduler)[\\/]/.test(
              id,
            )
          )
            return "vendor-react";
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:8081",
        changeOrigin: true,
      },
      // PI Program Board SignalR hub — needs WebSocket upgrade (ws: true).
      "/hubs": {
        target: process.env.VITE_API_PROXY || "http://localhost:8081",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
