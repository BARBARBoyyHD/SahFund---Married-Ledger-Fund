## Why

SahFund has no public entry surface: the site root renders nothing that explains the product or leads a prospective user to sign-up, and any unknown URL falls through to the framework default or a blank screen — violating NFR-07 ("explicit error, never a blank screen") and leaving the sign-up funnel (FR-01) unreachable from outside. E0 (US-54, US-56) is the only epic besides M2–M4 whose stories are untouched.

## What Changes

- New **landing page** at `/` (server component, no session, no data fetching): explains SahFund in Bahasa Indonesia, one primary CTA to `/login` sign-up mode, price claim exactly per FR-12 (Rp 49.000 intro / Rp 99.000 list, one-time — no subscription language), money via `src/core/money.ts`, mobile-first ≤ 1.5 s p95, WCAG 2.2 AA.
- New **404 page** (`not-found`): Bahasa Indonesia message, path back to home and (when a session exists) the dashboard, no data fetch, distinct from the US-43/44 database-error state, WCAG 2.2 AA.
- No backend, schema, API, or auth changes.

## Capabilities

### New Capabilities
- `entry-pages`: public site entry — landing page content/CTA/price-claim rules and the not-found (404) behaviour for unknown routes.

### Modified Capabilities
<!-- none — no existing spec-level requirement changes -->

## Impact

- Code: `src/app/page.tsx` (root page), `src/app/not-found.tsx`, small presentational components under `src/components/`; reuse `src/core/money.ts` for any rupiah figure.
- No DB, route-handler, session, or dependency changes.
- Sources: BRD §1, FR-01, FR-12, NFR-04, NFR-07, NFR-08, NFR-09; `docs/ui/DESIGN.md`; AGENTS.md §6 (server components, four states, a11y) — see USER-STORIES US-54, US-56.
