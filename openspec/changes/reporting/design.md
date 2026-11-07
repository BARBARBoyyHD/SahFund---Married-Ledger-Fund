## Context

Imports will produce transactions (import-reconciliation change), categories/commitments/budgets tables are specified in ITA §5, and US-29/US-31 (dashboard due dates, forecast) already exist — so this change builds the read/report surfaces and the remaining write flows around them. D1: no interactive transactions, `db.batch()` for multi-table writes. Performance budgets (BRD NFR-04): dashboard ≤ 1.5 s p95 on 4G.

## Goals / Non-Goals

**Goals:**
- A member can browse, filter, correct, and add transactions; budgets/commitments/attribution produce exact integer-minor-unit reports; the owner can share a read-only aggregate link.
- All aggregates in SQL (single aggregate query preferred), all lists filtered + paginated in the query, all money via `src/core/money.ts`.

**Non-Goals:**
- No new forecast logic (US-31 done — reuse `src/core/forecast.ts`).
- No export/CSV of reports (US-38 is E9), no share-link email (only invitations send email — FR-13/ADR-12), no transaction-level detail in shared views.
- No roles beyond owner/member for share management beyond "owner-only" per FR-11.

## Decisions

1. **URL search params own filter state** (US-19, AGENTS.md §6): filters live in the query string; server components read them; back button and copy-URL work for free. Alternative — client `useState` — rejected: state lost on navigation and invisible to the server render.
2. **Filter + paginate in SQL**: `WHERE workspaceId = ? AND … ORDER BY occurredOn DESC LIMIT/OFFSET` (existing index `transactions(workspaceId, occurredOn)`); category joins via one `inArray` fetch + Map, never N+1. Aggregates via Drizzle `SUM`/`GROUP BY` with bigint sums only (AGENTS.md §4).
3. **Bulk-attribute = one `db.batch()`** of UPDATEs (or a single UPDATE with `inArray`) scoped to `workspaceId`; partial failure reported by row — since D1 batches are all-or-nothing, "told exactly which rows updated" is satisfied by validating ids first and reporting unknown/foreign ids rather than mid-batch failure (no silent partial: every selected id gets a result row).
4. **Payee rules apply at import time only**: rule lookup happens while building new transaction rows in the import handler; stored rows are never rewritten by rule create/delete (US-23). Rule storage keyed `UNIQUE (workspaceId, payee)`.
5. **Share token = random app-side token stored in D1** (P6: no `gen_random_uuid()` in SQL): `UNIQUE` token, `expiresAt`, `revokedAt`/delete on revoke; `/r/:token` route resolves token → workspace aggregates with **no session**. Default TTL: 30 days (Appendix B-4 open — chose conservative expiry; owner can re-create). Revoke = immediate (row delete or flag checked on every resolve).
6. **Duplicate-payment surfacing (US-30, UX undefined in Appendix B-2)**: report marks commitment `paid` amounts that match a ledger transaction (same amount, same/near date) with a visible "kemungkinan ganda" note stating which figure is counted in totals — explicit, never auto-merged, never hidden.
7. **DB failure → US-43 error state, not zeros**: report queries wrapped so a failed query renders the error+retry screen; zeros render only on a successful query returning zero (US-27).

## Risks / Trade-offs

- [Offset pagination cost on large ledgers] → acceptable at v1.0 scale (≤ 5,000 rows/import, two-member workspaces); keyset pagination only if profiling shows a problem.
- [Duplicate-matching heuristic false positives] → surface as a *suggestion* with explicit "which figure counts" text; no automatic adjustment (US-30 requires visibility, not automation).
- [Shared link leaks aggregates without auth] → aggregates only (no descriptions, no member email), expiry + revocation, token random 128-bit+; matches FR-11 scope.
- [Seed categories vs user-renamed uniqueness] → uniqueness enforced by DB index (`UNIQUE (workspaceId, name)`), handler maps constraint violation to clear message (AGENTS.md §3).

## Open Questions

- Share-link default TTL (Appendix B-4): assumed 30 days — confirm with user before implementation; spec states "expiry SHALL be enforced" without pinning the default.
- Duplicate-match rule for US-30 (Appendix B-2): equal amount within a date window — refine during implementation review.
