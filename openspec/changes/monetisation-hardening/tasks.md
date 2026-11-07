## 1. Entitlement & gating (US-35, US-37, US-38)

- [ ] 1.1 Schema: entitlement grants table with `UNIQUE (orderId)` (+ workspaceId); migration generated/committed/applied local — US-37
- [ ] 1.2 Grant handler: one `db.batch()` insert per completed purchase (Rp 49.000/99.000), duplicate order id → no-op; failed/uncertain payment → state unchanged, error surfaced — US-37
- [ ] 1.3 Free-tier gate in import + export handlers: server-side structured 403 with unlock message (second import, export); first import passes; no client-only locks — US-35, US-38
- [ ] 1.4 Export route: paid + membership-verified, workspace-scoped rows only, machine-readable format (ISO dates, integer minor units per design) — US-38
- [ ] 1.5 Integration tests (local D1): grant idempotency per order, free second-import refused with message, paid export scoped — US-35, US-37, US-38
- [ ] 1.6 Pricing page: one-time Rp 49.000/99.000 copy per FR-12, privacy position alongside, no recurring language *(PEP §10 cut candidate #2 — defer first)* — US-36

## 2. Deletion & privacy (US-39–42)

- [ ] 2.1 Delete-workspace handler: owner-only check, ONE `db.batch()` cascade (transactions, imports, commitments, categories, memberships, grants, share tokens, rate-limit keys → workspace row), non-owner refused — US-39
- [ ] 2.2 Delete-account handler: sessions + user removed, sign-in fails; explicit owned-workspace path shown before confirm (per design assumption — confirm Appendix B-5 at review) — US-40
- [ ] 2.3 Document NFR-06 backup-purge operational procedure (≤ 30 days) — US-39, US-40
- [ ] 2.4 Privacy audit: no upload endpoints/object storage; grep handlers for file/row logging; single `logRoute(route, status, workspaceId)` helper adopted — US-41, US-42
- [ ] 2.5 Tests: cascade leaves no queryable orphans (post-delete query each table), account delete invalidates session — US-39, US-40

## 3. Rate-limit feedback (US-45)

- [ ] 3.1 Add import counter `imp:<workspaceId>` 20/hour to the existing fixed-window scheme (same no-write-on-deny semantics) — US-45
- [ ] 3.2 Shared 429 message builder: Bahasa Indonesia, limit + retry timing, used by auth and import; wire into auth form + import screen verbatim — US-45
- [ ] 3.3 Test: 21st import in an hour → explicit 429 with message, data unaffected, other workspaces independent — US-45

## 4. Quality bar audit & fixes (US-47–51)

- [ ] 4.1 Money audit: no floats/`Math.round(amount*100)`/raw `toString()`/`$`/`en-US` anywhere; reconcile tolerances exactly Rp 1 / Rp 0.05; fix findings — US-47
- [ ] 4.2 i18n audit: all copy Bahasa Indonesia per BRD wording, money/dates via shared modules; fix findings — US-48
- [ ] 4.3 WCAG 2.2 AA pass across all screens: labels/`aria-label`, `aria-live` errors, keyboard paths, focus rings, dialog focus trap + Escape, ≥ 4.5:1 contrast (green badge included), semantics; fix findings — US-49
- [ ] 4.4 Four-state pass: skeleton/empty/error+retry/success on every screen (incl. DB-down 503 from US-43); fix blanks — US-50
- [ ] 4.5 Performance verification: dashboard ≤ 1.5 s p95 and import ≤ 5 s p95 on preview, pdf.js dynamic-only (bundle check), ledger paginated; record numbers — US-51
- [ ] 4.6 Typecheck + unit + integration + Playwright happy path (PEP M4) green — all

## 5. Close-out

- [ ] 5.1 Mark US-35–42, US-45, US-47–51 ✅ (or list gaps) in `docs/projects/USER-STORIES.md`
- [ ] 5.2 Resolve design open questions at review: purchase mechanism (B-3), export format (B-1), account-delete workspace path (B-5)
