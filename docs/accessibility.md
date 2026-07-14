# Atlas PPM — Accessibility

Target: **WCAG 2.1 AA**. This doc is the single place that says what is covered
automatically, and the **manual screen-reader procedure** to run before a release
(the part that can't be automated). ADR history: 0025 (baseline), 0026 (axe +
mobile drawer), 0033 (browser sweep + logic tests), 0037 (contrast tokens + gate).

## 1. Automated coverage (CI-gated)

| Layer | What runs | Where |
|-------|-----------|-------|
| Primitive axe | jsdom axe over shared UI primitives (dialog, menu, buttons, inputs) | `src/components/a11y.test.tsx` (vitest) |
| Full-page sweep | Browser axe (WCAG 2 A/AA incl. **colour-contrast**) over representative routes: `/`, `/portfolio`, `/gantt`, `/roadmap`, `/resources`, `/admin`, `/demands` | `e2e/a11y.spec.ts` |
| Pointer-first canvas | Browser axe over the **whiteboard** canvas (roadmap scope) | `e2e/journeys/whiteboard-a11y.spec.ts` |
| Drag boards | Browser axe over the **Tasks Kanban** board and the **PI Program Board** with seeded cards (mocked API), plus assertions that cards expose accessible names | `e2e/journeys/board-a11y.spec.ts` |
| Keyboard logic | Unit tests for the pure move/geometry logic the keyboard paths reuse | `src/whiteboard/scene.test.ts`, `src/screens/gantt/model.test.ts` |

Every one of these **fails the build** on a WCAG 2 A/AA violation (structural or
contrast). The board sweeps use `page.route` to stub `/api/v1/*` so real cards
render headlessly — note `/roles` must return `{ roles: [] }` (an object), not an
array, or `usePermissions` throws.

### Keyboard operation (implemented, exercised by the sweeps)
- **Whiteboard canvas** — `role="application"` with an instructions label; each
  node is a focusable `role="button"` with an accessible name (kind + text) and
  `aria-pressed` for selection. Focus selects; arrows move (Shift = 1px), Enter/F2
  edits, Delete removes.
- **Tasks Kanban / Demand funnel** — cards are focusable buttons; Enter/Space
  opens, Arrow Left/Right moves column/stage (gated by the same capability as the
  drag). The funnel scroll region is keyboard-focusable.
- **PI Program Board** — each card carries a native iteration `<select>` (labelled
  "Move … to iteration"); the increment picker is labelled "Select program
  increment".

## 2. Manual screen-reader procedure (run before each release)

Automated axe catches missing names/roles/labels and contrast; it does **not**
verify that the *experience* makes sense to a screen-reader user. Run this pass on
**one** of: NVDA + Firefox/Chrome (Windows) or VoiceOver + Safari (macOS). Tick
each; file any miss as a bug.

**Shell & navigation**
- [ ] The sidebar exposes a `navigation` landmark; each item announces its label and current/selected state.
- [ ] The main content is in a `main` landmark; the page title/heading is announced on route change.
- [ ] The role switcher announces its options and the selected identity.

**Forms & dialogs**
- [ ] Opening a modal moves focus into it and announces its label; Escape closes and focus returns to the trigger.
- [ ] Every input has a programmatic label; errors are announced (not colour-only).

**Tasks Kanban board** (`/project?id=…&tab=tasks`)
- [ ] Tabbing reaches each card; it announces `{code} {name}. {status}.` and how to move it.
- [ ] Arrow Left/Right moves a card between columns and the new column is announced.
- [ ] Enter opens the card detail; focus lands inside.

**Demand funnel** (`/demands`)
- [ ] Cards announce demand id + title + stage; Arrow keys advance the stage where permitted.
- [ ] The funnel scroll region is reachable and operable by keyboard.

**PI Program Board** (`/pi-planning` → Program Board)
- [ ] The increment picker announces "Select program increment" and its value.
- [ ] Each card's iteration select announces "Move {objective} to iteration" and changing it moves the card.

**Whiteboard** (any entity → Whiteboard)
- [ ] The canvas announces as an application region with usage instructions.
- [ ] Each shape is reachable by Tab and announces its kind + text + selected state.
- [ ] Arrow keys move the focused shape; Enter edits text; Delete removes it.

**Statement of Applicability** (`/project?id=…&tab=security`)
- [ ] Theme sections announce expanded/collapsed; each control row's applicability toggle, status and owner are labelled.

## 3. Known limitations
- The route-level axe sweep covers **representative** routes, not every screen —
  extend `ROUTES` as new high-traffic views land.
- No **third-party / assistive-technology-user audit** has been commissioned yet;
  the procedure above is the internal pass. A formal external audit is a
  pre-GA recommendation.
- Reduced-motion: transitions are minimal (≤ ~0.1s); no global
  `prefers-reduced-motion` sheet (the app uses inline styles, no global CSS).
