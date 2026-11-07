## 1. Schema & seeds

- [x] 1.1 Migration: budgets (per category, `numeric({mode:'bigint'})`), commitments (total/paid/dueOn), share tokens (token UNIQUE, expiresAt, revoked), payee rules (`UNIQUE (workspaceId, payee)`), category uniqueness (`UNIQUE (workspaceId, name)`) — generate, commit, apply local — US-22, US-26, US-28, US-32
- [x] 1.2 Seed 10 Indonesian wedding categories on workspace create; duplicate-name constraint violation mapped to clear message (P3 classification in `src/lib/db/index.ts`) — US-22

## 2. Aggregates & pure logic (src/lib/reports, src/core)

- [x] 2.1 Contribution aggregate: in/out/net per member + separate unattributed line, SQL SUM with bigint minor units — US-25
- [x] 2.2 Budget-vs-actual aggregate: budget/committed/paid/remaining per category + totals row, over-budget unclamped — US-27
- [x] 2.3 Duplicate-payment matcher: commitment `paid` ↔ ledger transaction correspondence (equal amount, date window) returning surfaced pairs — US-30
- [x] 2.4 Unit tests: contribution sums exactness, over-budget marking, duplicate matcher true/false positives (node:test, no DB) — US-25, US-27, US-30

## 3. Route handlers (orchestration only: session → membership → Zod → lib → batch)

- [x] 3.1 Ledger read route/component data: query-side filter (date/category/member/direction/keyword) + pagination in SQL, workspace-scoped, `inArray` category joins — US-18, US-19
- [x] 3.2 PATCH transaction (category/member) + bulk-attribute handler: single `db.batch()`, per-row outcome reported (no silent partial) — US-20, US-24
- [x] 3.3 POST manual transaction: shared Zod, dedupe conflict surfaced via existing unique index, `source = manual` — US-21
- [x] 3.4 Budget + commitment handlers (create/update), owner-only share-token create/revoke handlers — US-26, US-28, US-32, US-34
- [x] 3.5 Integration tests (local D1): manual-entry dedupe conflict, bulk-attribute partial-reporting, category seed uniqueness, share token resolve/revoke — US-21, US-22, US-24, US-34

## 4. UI (server components read; client leaves for interactivity only)

- [x] 4.1 Ledger page: paginated newest-first table, empty state, filters+search in URL search params, money/dates via `src/core/money.ts` — US-18, US-19
- [x] 4.2 Re-categorise/reassign controls + bulk-select member action with result report — US-20, US-24
- [x] 4.3 Manual-entry form: shared Zod, inline Bahasa Indonesia errors, submit disabled in flight — US-21
- [x] 4.4 Contribution report (in/out/net, unattributed) and budget-vs-actual report (four figures + totals, over-budget mark, error state not zeros) — US-25, US-27
- [x] 4.5 Budget inputs (IDR → minor units via money module) + commitments form (DP/pelunasan) — US-26, US-28
- [x] 4.6 Duplicate-payment notice in report stating which figure counts — US-30
- [ ] 4.7 Payee-rule offer accept/decline on correction + rules list/delete *(PEP §10 cut candidate #4 — defer first)* — US-23
- [ ] 4.8 Share-link controls (owner-only, show expiry, revoke) + `/r/:token` read-only report (aggregates only) + unavailable page *(PEP §10 cut candidate #1 — defer second)* — US-32, US-33, US-34

## 5. States, a11y, verification

- [ ] 5.1 Loading skeleton / empty / error+retry / success on every new screen; DB failure → US-43 error state, never zeros — US-27, US-50-adjacent
- [ ] 5.2 Keyboard + WCAG 2.2 AA pass: labels, focus, ≥ 4.5:1 contrast, semantic table — US-49-adjacent
- [ ] 5.3 Performance: filter/paginate verified in SQL (no fetch-all-then-slice), aggregates in SQL, no N+1 — AGENTS.md §4
- [ ] 5.4 Typecheck + unit + integration tests green; manual walkthrough — US-18–22, US-24–28, US-30, US-32–34 marked ✅ or gaps listed in `docs/projects/USER-STORIES.md`
