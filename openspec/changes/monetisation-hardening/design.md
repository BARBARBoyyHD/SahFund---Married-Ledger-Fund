## Context

Entitlement, deletion, and the E12 quality pass are greenfield. Existing pieces to build on: `rate_limits` table + fixed-window counters (spec `rate-limiting`), `requireSession()` + membership checks, `db.batch()`, shared Zod/money/reconcile modules, US-43 error state. D1: no interactive transactions — cascades are explicit multi-table batches. Backup purge (≤ 30 days) is an operational property outside Workers code.

## Goals / Non-Goals

**Goals:**
- One-time purchase → idempotent entitlement grant gating second import/export; free tier never silently fails.
- Owner-only workspace cascade delete and account delete with an explicit owned-workspace path; zero file bytes; log redaction.
- Import rate limit + explicit 429 messaging; a verified a11y/i18n/performance/quality pass producing evidence, not assumptions.

**Non-Goals:**
- No payment UI beyond what FR-12 requires until mechanism is chosen (Appendix B-3) — no subscription/recurring anything (§10).
- No automated backup-purge implementation (documented operational procedure for M5); no audit-log feature; no new test tooling beyond Playwright already planned in PEP M4.

## Decisions

1. **Entitlement keyed by order id, mechanism-agnostic** (US-37, ITA §6): a grant table with `UNIQUE (orderId)` written in one `db.batch()` — webhook/manual-code/idempotency all reduce to "insert grant for order id; duplicate = no-op". Gating = grant exists for `workspaceId`. Alternative — entitlement column on workspace: rejected (loses idempotency history for retries).
2. **Free-tier gate in the import/export handlers, message in the UI**: server refuses second import/export with a structured 403 carrying the unlock message; client renders it verbatim — no client-only lock (client locks are UX, not enforcement).
3. **Export = streamed CSV of this workspace's rows** (Appendix B-1 format open): built from one workspace-scoped query, amounts/dates via `src/core/money.ts` conventions (machine-readable: minor-unit integers + ISO dates are the export form; display formatting stays in-app) — flagged as open question.
4. **Deletion = one `db.batch()` per action**: workspace delete queues deletes for transactions, imports, commitments, categories, memberships, grants, share tokens, rate-limit keys, then the workspace row (FK order within batch); account delete queues sessions + user, with the owned-workspace path resolved first per US-40 (delete-with-it vs handover is stated in UI copy — Appendix B-5 assumption: delete-with-it when sole member, explicit handover prompt when a second member exists).
5. **Log redaction as a single helper + review task** (US-42): a `logRoute(route, status, workspaceId)` used by handlers; never pass row contents/amounts. The E12 pass greps for `console.log` of data as evidence.
6. **US-45 = extend existing counter scheme** with `imp:<workspaceId>` at 20/hour (same fixed-window, no-write-on-deny semantics); rejection response carries a standard Bahasa Indonesia 429 body with limit + retry timing for both auth and import — one shared message builder.
7. **E12 is a verification epic, not new code**: each US-47–51 task is an audit + fix loop with recorded evidence (test output, contrast checks, Lighthouse/trace numbers, bundle inspection for pdf.js). Fixes stay surgical; no new abstractions.

## Risks / Trade-offs

- [Purchase mechanism still undecided (Appendix B-3)] → grant shape is fixed now; wiring the actual payment provider is a thin adapter later — spec deliberately says "completed purchase", not "Lynk.id".
- [Account delete leaves the other member's workspace broken] → US-40 requires an explicit stated path; default assumption above must be confirmed in review before implementation.
- [Rate limit false positives on shared IPs (auth 10/min)] → per BRD; messages tell users when to retry — no silent blocking.
- [E12 audit finds systemic a11y debt late] → run the audit incrementally per screen as earlier changes land; this change closes residuals rather than discovering them cold.

## Open Questions

- Purchase mechanism: license code vs Lynk.id order (Appendix B-3) — blocks only the thin grant-trigger adapter, not entitlement semantics.
- Export file format (Appendix B-1): proposed machine-readable CSV (ISO dates, integer minor units) — confirm at review.
- Account-delete + existing second-member workspace path (Appendix B-5): delete-with-it vs forced handover — confirm at review.
