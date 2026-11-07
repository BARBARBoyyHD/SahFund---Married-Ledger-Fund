## Why

E3 (Statement Import) and E4 (Reconciliation) — plus US-44, the import-specific error story — are completely untouched: SahFund cannot yet ingest a bank statement or prove it against the printed balance, which is the product's core value proposition (BRD FR-03, FR-04) and PEP M2's exit criterion ("a real redacted statement imports and reproduces the bank's closing balance"). PEP §10 marks reconciliation and Jago import as **never-cut**, so this change is the highest-priority outstanding work.

## What Changes

- **Jago PDF import, parsed on-device** (US-09): browser-side pdf.js extraction of the text layer; only derived rows + reconciliation JSON posted to the server; no file bytes uploaded/stored/logged; no text layer → clear parse failure, never OCR.
- **CSV/XLSX import via column mapping** (US-10, PEP cut candidate): map date/description/amount/balance(/ref/time) into the same canonical `Statement` shape; downstream stays bank-agnostic (ADR-06).
- **Pocket + period selection** (US-11), **preview → atomic commit** (US-12: new/duplicate counts, single `db.batch()`, 5,000-row cap validated by shared Zod), **idempotent re-import** (US-13: `dedupe_hash` unique index, concurrent overlap no-op).
- **Reconciliation** (US-14–17): green "Cocok dengan saldo bank" with Rp 1 / Rp 0.05 tolerances, issues by kind with the offending line, server re-runs the same pure `src/core/reconcile.ts` and its verdict is authoritative, flagged imports (`reconciled = false`) stay out of trusted totals until explicitly confirmed.
- **Parse-failure detail** (US-44): offending line shown in Bahasa Indonesia, nothing persisted on failure.

## Capabilities

### New Capabilities
- `statement-import`: on-device statement extraction, column mapping, pocket/period choice, preview/commit atomicity, dedupe idempotency, parse-failure reporting.
- `reconciliation`: balance-chain verification with tolerances, failure issue reporting, server-side re-verification, flagged-import confirmation gating trusted totals.

### Modified Capabilities

<!-- none — no existing spec-level requirement changes -->

## Impact

- Code: `src/core/reconcile.ts` (pure), `src/adapters/*` (Jago PDF, CSV), import UI under `apps/frontend/src/app/` (pdf.js dynamic import only), `POST /imports` route handler, `src/lib/db/schema.ts` (dedupe unique index / import columns as needed — follow existing migration flow), `src/lib/db/index.ts` error classification.
- Constraints: AGENTS.md §2 (`db.batch()`, no transactions), §3 (DB-enforced dedupe), §4 (workspace scoping, no N+1), §7 (one reconcile implementation shared client/server), §9 (no file storage), P1–P8 portability.
- Sources: BRD FR-03, FR-04, NFR-01; ITA §2, §5, ADR-05/ADR-06; USER-STORIES US-09–13, US-14–17, US-44.
