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
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-msal": ["@azure/msal-browser", "@azure/msal-react"],
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
    },
  },
});
