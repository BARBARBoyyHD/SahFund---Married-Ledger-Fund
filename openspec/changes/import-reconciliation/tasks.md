## 1. Core logic (pure, unit-tested first)

- [x] 1.1 `src/core/reconcile.ts`: single reconciliation implementation — balance chain (opening + masuk − keluar vs printed closing, Rp 1 tolerance), totals (Rp 0.05), issue kinds `balance_chain`/`totals`/`opening`/`duplicate`/`empty` with offending-line detail — US-14, US-15, US-16
- [x] 1.2 Unit tests for reconcile: green path, tampered amount → `ok:false`, tolerance boundaries, each issue kind (node:test, no DB) — US-14, US-15
- [x] 1.3 Dedupe hash function: exactly one implementation over `workspaceId|date|time|amount|balance|ref` — US-13
- [x] 1.4 Unit tests for dedupe hash: stability, distinct-row separation (ITA §11) — US-13

## 2. Adapters (fixture-tested, bank-agnostic)

- [x] 2.1 Jago PDF adapter: text-layer extraction → canonical `Statement`, on-device only; no-text-layer → typed parse error (never OCR) — US-09
- [x] 2.2 CSV/XLSX adapter: column mapping (date, description, amount, balance, optional ref/time) → same canonical `Statement`; malformed/unmappable → error naming the offending input — US-10
- [x] 2.3 Adapter fixtures + tests: redacted Jago statement, CSV variant, no-text-layer PDF, malformed line — US-09, US-10, US-44

## 3. Schema & persistence

- [x] 3.1 Schema: import row + transactions; `UNIQUE (workspaceId, dedupeHash)` via `schema.ts` expressions (P1); `numeric({ mode: 'bigint' })` money columns (P5); generate + commit migration, apply local — US-12, US-13
- [x] 3.2 `POST /imports` handler: `requireSession()` → workspace membership → shared Zod body (5,000-row cap) → server re-runs `src/core/reconcile.ts`, stores **server** verdict → ONE `db.batch()` for import + rows → respond; duplicates dropped by index — US-12, US-13, US-16
- [x] 3.3 Flagged-import confirm endpoint: single-row write setting confirmed flag; trusted aggregates exclude `reconciled = false` unconfirmed rows — US-17
- [x] 3.4 Integration test (local D1): import → persist → duplicate re-import no-op → totals unchanged; concurrent overlapping import; parse failure persists nothing — US-13, US-44

## 4. Import UI (client leaves only)

- [x] 4.1 Import page: file input + dynamic pdf.js import (never in root bundle), on-device parse, preview of normalised rows — US-09
- [x] 4.2 CSV/XLSX column-mapping step reusing the same preview flow — US-10 *(PEP §10 cut candidate — defer first)* — **CSV path shipped**; `.xlsx` shows a clear "ekspor dulu sebagai CSV" message (no spreadsheet dependency added, per this change's no-new-dependency rule)
- [x] 4.3 Pocket picker + period pre-fill/override; totals scoped to selected pocket — US-11
- [x] 4.4 Preview: reconciliation banner (green "Cocok dengan saldo bank" with Saldo awal/Masuk/Keluar/Saldo akhir, or issues-by-kind list with offending line + Batal/lanjut), "N transaksi baru · M duplikat" counts, 5,000-row error — US-12, US-14, US-15
- [x] 4.5 Parse-failure state: offending line + Bahasa Indonesia reason, nothing persisted, retry works — US-44
- [x] 4.6 Flagged import banner + explicit confirm action ("belum cocok" stays visible) — US-17

## 5. States, a11y, verification

- [x] 5.1 Loading/empty/error+retry/success states on the import screen; labels, keyboard path, `aria-live` errors (AGENTS.md §6, NFR-08)
- [x] 5.2 Four-state + keyboard-only manual walkthrough; typecheck + unit + integration tests green (AGENTS.md §11)
- [x] 5.3 Verify no file bytes reach server/storage/logs (grep handlers for content logging; NFR-01) — US-09, US-41-adjacent
- [x] 5.4 Mark US-09, US-11–17, US-44 (and US-10 if built) ✅ in `docs/projects/USER-STORIES.md` — US-10 left unmarked (`.xlsx` not implemented), US-17 left unmarked (forecast + contributions aggregates do not yet apply `trustedTotalsCondition`)
- [x] 5.5 Trusted-totals gate applied to ALL transaction aggregates (Kontribusi, forecast, laporan) — US-17 AC3
