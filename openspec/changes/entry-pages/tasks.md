## 1. Landing page (US-54)

- [ ] 1.1 Verify `apps/frontend/src/app/page.tsx` + `src/components/landing/*` against US-54 ACs: single primary CTA → `/login` (sign-up mode), no session/workspace fetch, no client data fetching
- [ ] 1.2 Audit price/entitlement copy in the Pricing section against FR-12 exactly (Rp 49.000 intro / Rp 99.000 list, one-time per wedding, no subscription wording, no claims beyond BRD §1/§3)
- [ ] 1.3 Ensure every rupiah figure renders via `src/core/money.ts` (`Rp 1.234.567` form) — fix any hard-coded/en-US formatting
- [ ] 1.4 WCAG 2.2 AA pass on `/`: labelled controls, ≥ 4.5:1 contrast, heading order, visible focus path to the CTA (fix issues found)
- [ ] 1.5 Mobile-first/4G check: no horizontal scroll at phone width, no desktop-only content; measure load against the 1.5 s p95 analogy on preview (note result, defer formal budget to M5)

## 2. 404 page (US-56)

- [ ] 2.1 Verify `apps/frontend/src/app/not-found.tsx` renders for unknown/malformed URLs signed-in and signed out — Bahasa Indonesia, no framework default, no blank screen, no stack trace
- [ ] 2.2 Verify way-back links (landing page + sign-in path) work and that rendering performs no data fetch
- [ ] 2.3 Confirm 404 state is visually distinct from the database-error/retry screen (US-44 class) and never shows a 500-style message
- [ ] 2.4 WCAG 2.2 AA pass on the 404: heading order, link focus, contrast ≥ 4.5:1, keyboard-only reachability (fix issues found)

## 3. Verification

- [ ] 3.1 Manual four-state + keyboard-only walkthrough of `/` and an unknown URL (AGENTS.md §6/§11) — record pass/fail per AC
- [ ] 3.2 Typecheck + lint clean; run existing unit tests — no regressions
- [ ] 3.3 Mark US-54 and US-56 ✅ in `docs/projects/USER-STORIES.md` if all ACs pass (or list gaps as follow-up)
