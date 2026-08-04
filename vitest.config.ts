import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      // Exclude tests, the test harness, bundled fonts, the app entrypoint, and
      // static reference/data modules — none are meaningfully unit-testable.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/fonts/**",
        "src/main.tsx",
        "src/i18n/messages.ts",
        "src/data/**",
      ],
    },
  },
});
