## Context

The root landing page (`apps/frontend/src/app/page.tsx`, section components under `src/components/landing/`) and the 404 (`apps/frontend/src/app/not-found.tsx`) already exist as server components with Bahasa Indonesia copy — but neither story (US-54, US-56) is marked done in `docs/projects/USER-STORIES.md`, so acceptance criteria may have gaps (price-claim exactness, money formatting, performance/a11y) and no test/verification pass exists. No backend, schema, or session logic is involved.

## Goals / Non-Goals

**Goals:**
- Bring `/` and the not-found route into full compliance with US-54 and US-56 acceptance criteria (FR-12 price claim, `Rp 1.234.567` money format, ≤ 1.5 s p95, WCAG 2.2 AA, no data fetching).
- Leave a traceable verification (checklist/tests) so the stories can be marked ✅.

**Non-Goals:**
- No redesign of the landing page, no new sections, no animation work beyond what exists.
- No auth/workspace/dashboard changes; no API routes; no new dependencies.
- Not adding a separate landing-page performance budget doc — NFR-04 applied by analogy only.

## Decisions

1. **Keep both pages as server components with zero client data fetching** (AGENTS.md §6) — alternatives (client fetch of price/config) rejected: adds waterfall and violates "server component by default".
2. **Price figures render through `src/core/money.ts`** — single source for "Rp 49.000 / Rp 99.000" formatting; hard-coded strings in copy checked against FR-12 wording instead of re-deriving formatting. Rationale: AGENTS.md §7 (one money module); rejection of `toLocaleString` copies.
3. **404 stays a static `not-found.tsx` with no session read** — the "dashboard link when session exists" criterion is met by the existing "Masuk ke akun" path (unauthenticated render must not fetch); distinguishing 404 from the US-44 DB-error state is a rendering concern, not a shared component.

## Risks / Trade-offs

- [Price claim drifts from FR-12 (subscription wording, wrong tiers)] → spec scenario pins the exact tiers; verify copy against BRD FR-12 at review.
- [Existing 404 has no "dashboard when signed in" link] → acceptable: rendering must require no fetch (US-56 AC); the sign-in path covers navigation without a session probe.
- [Performance budget unmeasurable without a preview deploy] → verify with Lighthouse/devtools on preview during M5 dogfood; not a code gate here.

## Open Questions

- None blocking. Whether US-54/US-56 get ✅ immediately (pages already exist) is decided by running the verification tasks, not by this design.
