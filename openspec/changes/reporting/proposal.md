## Why

E5 (Ledger), E6 (Categories & Rules), the rest of E7 (Reporting & Forecast), and E8 (Share Report) are untouched — 14 outstanding stories. Without them the imported data is unreadable: members cannot browse, filter, categorise, budget, attribute spending, or show progress to family (BRD FR-05–FR-11; PEP M3 exit: "a partner can read the report without a walkthrough"). Share link, CSV-in-UI, and payee rules are PEP §10 cut candidates and are marked accordingly in tasks; the ledger and report cores are not.

## What Changes

- **Ledger** (US-18–21): newest-first paginated/virtualised list; date/category/member/direction filters + keyword search with **URL-as-state** (query-side filtering, never fetch-all-then-slice); re-categorise/reassign with immediate update; manual transaction entry (`source = manual`, shared Zod, dedupe-conflict surfaced, inline Bahasa Indonesia errors).
- **Categories & rules** (US-22–23): seed 10 Indonesian wedding categories on workspace creation with `UNIQUE (workspaceId, name)`; payee→category rules accepted from a correction, applied to **newly imported rows only** (never retroactive), deletable — *cut candidate*.
- **Reporting** (US-24–28, US-30): bulk-attribute member to a selection (all-or-reported, no silent partial); per-member contributions (in/out/net, unattributed shown separately); per-category budgets in integer minor units; budget-vs-actual report (budget/committed/paid/remaining + totals row, over-budget marked, DB failure → US-43 error state); vendor commitments (total/DP/paid/due); double-counted payments surfaced visibly — never silently counted twice or dropped.
- **Share report** (US-32–34): owner-only expiring, revocable token → `/r/:token` read-only aggregates (totals, category breakdown, forecast — **no transaction descriptions, no mutation**), invalid/expired/revoked → clear unavailable page — *cut candidate*.

## Capabilities

### New Capabilities
- `ledger`: chronological browse, URL-state filtering/search, category/member correction, manual entry with dedupe conflict handling.
- `categories`: seeded workspace category set with unique names, payee-rule creation/application/deletion semantics.
- `reporting`: contribution attribution, per-category budgets, budget-vs-actual aggregation, vendor commitments, visible duplicate-payment reconciliation.
- `share-report`: token creation, unauthenticated read-only aggregate view, revocation and expiry behaviour.

### Modified Capabilities

<!-- none — no existing spec-level requirement changes -->

## Impact

- Code: `src/app/**` ledger/report/share routes (server components read, route handlers mutate), `src/lib/reports/*` (SQL aggregates, BIGINT sums), `src/core/forecast.ts` reused as-is (US-31 done), `src/lib/db/schema.ts` (categories seed support, budgets, commitments, share tokens — existing migration flow), `src/core/money.ts` for all display.
- Constraints: AGENTS.md §4 (query-side filter/paginate, `inArray` batching, workspace scoping), §5 (handlers orchestrate only), §6 (URL is state, four states, a11y), §7 (one forecast/money implementation), P5/P7.
- Sources: BRD FR-05–FR-09, FR-11; USER-STORIES US-18–28, US-30, US-32–34.
