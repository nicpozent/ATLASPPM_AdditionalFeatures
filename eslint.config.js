import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "*.config.js", "*.config.ts", "coverage"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      // --- Ratchets (warnings only for now) ---------------------------------
      // File-size pin, set just above today's worst file (src/screens/Project.tsx,
      // ~1375 lines). It can only be LOWERED as the god-object screens are split
      // (R13/R18) — never raised.
      "max-lines": ["warn", { max: 1400, skipBlankLines: true, skipComments: true }],
      // Function-size pin — a starting ceiling; lower it as functions are broken up.
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],
      // Every colour must come from src/theme.ts (color.*) — CLAUDE.md §3. Ban
      // literal #RRGGBB hex in string literals. Warn for now; R10 does the sweep
      // and flips it to "error". The four files that legitimately need literal hex
      // are allowlisted below (kept in sync with R10's exception list).
      "no-restricted-syntax": ["warn", {
        selector: "Literal[value=/#[0-9a-fA-F]{6}\\b/]",
        message: "Literal hex colours are banned (CLAUDE.md §3) — use a token from src/theme.ts (color.*).",
      }],
    },
  },
  {
    // Allowlist: these four files legitimately carry literal #RRGGBB and must not
    // trip the colour ban (kept in agreement with R10's legitimate-exception list).
    files: [
      "src/theme.ts",
      "src/whiteboard/exportScene.ts",
      "src/whiteboard/templates.ts",
      "src/whiteboard/types.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  }
);
