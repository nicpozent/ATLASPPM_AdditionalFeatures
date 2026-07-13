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
  from the prototype, with **per-profile dark mode** (light/dark CSS-variable
  palettes; ADR-0056). Fonts: Space Grotesk / Public Sans / Space Mono.
- **Screen catalogue & roles** — `src/nav.ts`.
- **API + auth helpers** — `src/api.ts` (typed fetch + React Query),
  `src/auth.ts` (Entra/MSAL, disabled by default).
- **All screens built & data-wired** — `src/screens/*.tsx` implement each screen
  against `/api/v1` with loading/empty/error states (empty by default until data
  loads). See `docs/architecture/` (HLD/LLD/ABB-SBB/ADRs), `docs/requirements.md`
  (functional/non-functional/candidate), `docs/application-evaluation.md` and
  `docs/user-stories.md` for the full picture.

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
observability, retention, security hardening, Jira, [notification email via
Microsoft Graph](./docs/email-graph-setup.md), [Teams channel
notifications](./docs/teams-setup.md)). The **architecture reference**
— High Level Design, Low Level Design, ABB/SBB catalogue and ADRs, with diagrams —
is in [`docs/architecture/`](./docs/architecture/). Open engineering follow-ups
are tracked in [`docs/pi-board-followups.md`](./docs/pi-board-followups.md). The
Sweden legal/regulatory map for the personnel-data features is in
[`docs/compliance-sweden.md`](./docs/compliance-sweden.md), with a pre-filled
DPIA template in [`docs/dpia-personnel-data.md`](./docs/dpia-personnel-data.md).
