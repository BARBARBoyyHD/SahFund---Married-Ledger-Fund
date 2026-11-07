## Context

Nothing of E3/E4 exists yet: no import UI, no adapters, no `POST /imports`. The schema side (transactions, imports, dedupe) and pure-logic expectations are already specified in AGENTS.md §2–§4 and ITA §2/§5 — this change implements them. D1 has no interactive transactions; `db.batch()` is the atomic primitive. Money is 64-bit integer minor units; floats are banned. The browser computes reconciliation for the live gate, but the server must re-run the same pure function (AGENTS.md §3/§7).

## Goals / Non-Goals

**Goals:**
- A real redacted Jago statement imports end-to-end and reproduces the bank's closing balance (PEP M2 exit).
- CSV/XLSX column-mapping path producing the identical canonical shape.
- Idempotent, concurrency-safe, atomic persistence; parse failures persist nothing.
- One reconciliation implementation shared by client gate and server; flagged imports never silently trusted.

**Non-Goals:**
- No OCR, no LLM, no bank API, no file storage (AGENTS.md §10) — no-text-layer PDFs are failures, not a feature gap.
- No import queue/background jobs, no statement editing UI beyond what US-15 needs, no report changes (trusted-totals *gating* lives here; report rendering is the reporting change).
- No new dependencies beyond pdf.js already planned for client-side extraction.

## Decisions

1. **Parse in the browser, post derived rows only** (US-09, ADR-05): pdf.js runs client-side via dynamic import (never in root bundle); the payload is normalised rows + client reconciliation JSON. Alternative — server-side PDF parsing — rejected: file bytes would touch the server and risk storage/logging of documents (NFR-01).
2. **Adapter boundary at `Statement`** (ADR-06): Jago PDF and CSV/XLSX mappers both emit the same canonical shape; pocket/period selection and everything downstream are bank-agnostic. Adding a bank later = new adapter + fixtures, zero core changes.
3. **Idempotency enforced by a DB unique index, not handler logic**: `UNIQUE (workspaceId, dedupeHash)`; `dedupeHash` computed app-side by exactly one pure function (no `sha256()` in SQL — P6). Re-import drops duplicates as a no-op; two concurrent overlapping imports both succeed and the index removes the overlap (AGENTS.md §3).
4. **One `db.batch()` per commit**: import row + up-to-5,000 transaction rows queued together — a partial import is impossible (AGENTS.md §2). The 5,000-row cap and payload shape validated by the shared Zod schema before the batch fires.
5. **Server re-runs reconciliation with the same `src/core/reconcile.ts`**; stored server verdict governs the green state and trusted totals; client field is advisory input only (AGENTS.md §3 "never trust the client").
6. **Flagged-import gating**: `reconciled = false` rows are excluded from trusted aggregates until an explicit confirm action (US-17); confirm stores a flag, issues stay visible ("belum cocok"). No transaction is needed — flag update is a single-row write.
7. **Parse failure = no write at all** (US-44): validation/parsing happens before any statement is queued; the offending line is returned to the browser. Contrast with *reconciliation* failure, which still persists the import flagged (US-15) — the two are deliberately different.

## Risks / Trade-offs

- [pdf.js worker/main-thread fallback on cheap Android] → dynamic import + main-thread fallback path; measured against the ≤ 5 s p95 import budget during M5 dogfood.
- [Dedupe hash collisions dropping legitimate rows] → hash covers workspaceId|date|time|amount|balance|ref per ITA §5; covered by duplicate re-import tests (ITA §11).
- [5,000-row batch near D1 request-size limits] → Zod cap + integration test at the boundary; if the batch exceeds limits, split is NOT allowed (atomicity) — shrink payload or fail cleanly instead.
- [Client/server reconcile divergence] → single implementation, unit tests in `src/core` shared by both call sites; server result stored, never the client's.

## Open Questions

- None blocking. CSV/XLSX is a PEP §10 cut candidate — if schedule slips, tasks for US-10 are the first to defer; it does not affect the other stories' specs.
