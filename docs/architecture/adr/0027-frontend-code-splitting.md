# ADR-0027 — Frontend route-level code-splitting + vendor chunking

**Status:** Accepted

## Context
The SPA shipped as a **single ~1 MB JS chunk** (250 kB gzipped). Every user
downloaded and parsed the code for all ~24 screens before the first paint, even
though a session typically touches a handful. Vite emitted a chunk-size warning on
every build. The two big costs were (1) all screen code in the entry bundle and
(2) rarely-changing vendor libraries bundled with fast-changing app code, so any
app edit busted the vendor cache.

## Decision
- **Route-level splitting.** Every screen in `App.tsx` is loaded with `React.lazy`,
  so each becomes its own chunk fetched only when its route is first visited. The
  shell wraps `<Outlet/>` in a `<Suspense>` boundary with a minimal `role="status"`
  loader, nested inside the existing route-keyed `ErrorBoundary`.
- **Vendor chunking.** `vite.config.ts` `manualChunks` splits `react`/`react-dom`/
  `react-router-dom`, `@tanstack/react-query`, and the MSAL packages into stable
  `vendor-*` chunks that cache independently of app code.
- **Heavy on-demand libs stay dynamic.** `pptxgen` (exports) was already a dynamic
  import and remains its own chunk, pulled only when a user exports.

## Consequences
- **+** Entry bundle drops from ~1 MB to ~71 kB; the largest eager cost is
  `vendor-react` (~200 kB / 65 kB gz), cached across deploys. No more chunk-size
  warning. Screens range 2–50 kB each and stream in per navigation.
- **+** An app-code change no longer invalidates the vendor chunk cache.
- **−** First visit to a screen incurs a tiny fetch; mitigated by the lightweight
  Suspense loader and HTTP caching. Route prefetch-on-hover could hide it further
  (deferred — not worth the complexity yet).
- **−** `Project` is still a large chunk (~200 kB) because it's a deep, tabbed
  screen; it could be split further by tab if it grows.

## Alternatives considered
- **Keep the monolith, just raise `chunkSizeWarningLimit`** — silences the warning
  without fixing the actual download/parse cost; rejected.
- **Split only vendor, not routes** — leaves all screen code eager; the routes are
  where most of the weight and the natural boundaries are.
