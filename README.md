# Atlas PPM — Frontend

Portfolio & Project Management UI for **Birgma / Biltema Group**. React 18 +
TypeScript + Vite. This is the frontend only; it talks to a REST API at `/api/v1`.

> **If you are Claude Code, read [`CLAUDE.md`](./CLAUDE.md) first.** It defines the
> build rules: recreate every screen 1:1 from `design/Atlas PPM.dc.html`, style
> inline with the tokens in `src/theme.ts`, and keep screens empty (no seed data)
> until the API provides it.

## Run

```bash
npm install
cp .env.example .env      # leave VITE_AUTH_ENABLED=false to browse with no backend
npm run dev               # http://localhost:5173
```

`npm run build` type-checks and builds for production.

## What's already here

- **App shell** — faithful sidebar (role-aware nav, Birgma+Biltema brand, user
  footer) and topbar (title/subtitle, role switcher, notifications, Export).
- **Routing** — every screen has a route (`src/App.tsx`).
- **Design tokens** — `src/theme.ts` (colors, fonts, radius, layout), extracted
  from the prototype. Fonts: Space Grotesk / Public Sans / Space Mono.
- **Screen catalogue & roles** — `src/nav.ts`.
- **API + auth helpers** — `src/api.ts` (typed fetch + React Query ready),
  `src/auth.ts` (Entra/MSAL, disabled by default).
- **Every screen stubbed** — `src/screens/*.tsx` render an `EmptyState`; replace
  each body with the real screen.

## The reference

`design/Atlas PPM.dc.html` is the approved, pixel-perfect prototype and the single
source of visual truth. Open it in a browser and build to match it exactly.

## Structure

```
src/
├─ theme.ts            design tokens
├─ nav.ts              SCREENS, nav groups, ROLES
├─ api.ts / auth.ts    API client + Entra auth
├─ App.tsx / main.tsx  router + entry
├─ components/         AppShell, Sidebar, Topbar, Icon, RoleContext, EmptyState
└─ screens/            one component per screen (build these)
```

## Stack

React 18 · TypeScript (strict) · Vite · react-router-dom v6 · TanStack Query ·
@azure/msal-browser. **Inline styles only** (no CSS framework) to match the
prototype.

## Documentation

Setup & ops guides live in [`docs/`](./docs/) (setup, docker, sso, secrets,
observability, retention, security hardening, Jira). The **architecture reference**
— High Level Design, Low Level Design, ABB/SBB catalogue and ADRs, with diagrams —
is in [`docs/architecture/`](./docs/architecture/).
