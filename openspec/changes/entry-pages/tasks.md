## 1. Landing page (US-54)

- [x] 1.1 Verify `apps/frontend/src/app/page.tsx` + `src/components/landing/*` against US-54 ACs: single primary CTA → `/login` (sign-up mode), no session/workspace fetch, no client data fetching
- [x] 1.2 Audit price/entitlement copy in the Pricing section against FR-12 exactly (Rp 49.000 intro / Rp 99.000 list, one-time per wedding, no subscription wording, no claims beyond BRD §1/§3)
- [x] 1.3 Ensure every rupiah figure renders via `src/core/money.ts` (`Rp 1.234.567` form) — fix any hard-coded/en-US formatting
- [x] 1.4 WCAG 2.2 AA pass on `/`: labelled controls, ≥ 4.5:1 contrast, heading order, visible focus path to the CTA (fix issues found)
- [x] 1.5 Mobile-first/4G check: no horizontal scroll at phone width, no desktop-only content; measure load against the 1.5 s p95 analogy on preview (note result, defer formal budget to M5)

## 2. 404 page (US-56)

- [x] 2.1 Verify `apps/frontend/src/app/not-found.tsx` renders for unknown/malformed URLs signed-in and signed out — Bahasa Indonesia, no framework default, no blank screen, no stack trace
- [x] 2.2 Verify way-back links (landing page + sign-in path) work and that rendering performs no data fetch
- [x] 2.3 Confirm 404 state is visually distinct from the database-error/retry screen (US-44 class) and never shows a 500-style message
- [x] 2.4 WCAG 2.2 AA pass on the 404: heading order, link focus, contrast ≥ 4.5:1, keyboard-only reachability (fix issues found)

## 3. Verification

- [x] 3.1 Manual four-state + keyboard-only walkthrough of `/` and an unknown URL (AGENTS.md §6/§11) — record pass/fail per AC
- [x] 3.2 Typecheck + lint clean; run existing unit tests — no regressions
- [x] 3.3 Mark US-54 and US-56 ✅ in `docs/projects/USER-STORIES.md` if all ACs pass (or list gaps as follow-up)

---

## Verification record

Run against the dev server on `localhost:3000`, headless Chromium, 57/57 checks passed.

**Code changes made (2 files, both presentational):**

| File | Change |
|---|---|
| `src/components/landing/faq.tsx` | FAQ price sentence now interpolates `formatRupiah(rupiahToMinor(49_000))` / `(99_000)` instead of literal `"Rp 49.000"` / `"Rp 99.000"` — the last hard-coded rupiah figures on the page |
| `src/components/landing/reconcile-demo.tsx` | `placeholder="Rp 0"` → `placeholder={formatRupiah(0)}` |

Everything else passed as-is; no a11y, structural, or copy fixes were needed.

**AC-by-AC result**

| AC | Result | Evidence |
|---|---|---|
| Explains product in Bahasa Indonesia, one primary CTA → sign-up | PASS | `h1` "Dana nikah, tercatat berdua."; 3 CTAs → `/login`, sign-up is the default mode (`login-panel.tsx`: `params.mode === "masuk" ? "sign-in" : "sign-up"`); sign-in kept on a separate `/login?mode=masuk` link |
| No session / no client fetch | PASS | 0 XHR/fetch/api requests on `/`; `page.tsx` imports no session/db module; `grep getSession\|requireSession` over `src/components/` → no matches |
| Price claim matches FR-12 | PASS | `Rp 49.000` + `Rp 99.000` present; "Satu kali bayar", "Sekali per pernikahan, bukan langganan", "tetap sekali bayar", "Tidak ada tagihan berulang"; no price quoted as recurring; no `$` / en-US grouping |
| Money via shared module | PASS | 29 `Rp …` figures on the page, all matching `^Rp \d{1,3}(\.\d{3})*$`; 0 malformed |
| WCAG 2.2 AA on `/` | PASS | heading sequence `1,2,3,3,3,2,3,3,3,3,2,2,2` (no skips, one `h1`); 0 unlabelled controls; Tab reaches the primary CTA; focus ring visible at every stop |
| Mobile-first, no horizontal scroll | PASS | `scrollWidth == clientWidth` at 320 / 360 / 375 px; desktop grid not applied at any phone width; all 6 sections render |
| 404 for unknown URL (signed out) | PASS | HTTP 404 + Bahasa Indonesia heading; no console/page errors; 0 data fetches |
| 404 for unknown URL (signed in) | PASS | same, after a real sign-up |
| Malformed URLs | PASS | `/%2`, `/a%zzb`, `/foo%2F%2Fbar%3Fx=1`, deep missing route → all render the 404 screen, none 500, no stack trace |
| Way-back links | PASS | `Kembali ke beranda` → `/`; `Masuk ke akun` → `/login?mode=masuk` |
| 404 ≠ DB-error screen | PASS | no `RetryPanel` copy ("Layanan sedang tidak tersedia" / "Coba lagi") on the 404; no 500-style message |
| 404 WCAG AA | PASS | single `h1`; keyboard reaches the way-back link; focus visible at every stop |
| Four states (AGENTS §6) | PASS | both pages server-render fully with JS disabled (3579 / 155 chars of copy) — no blank screen, and no loading/empty/error state is applicable to pages with no data dependency; the 404 *is* the explicit error state |
| Typecheck / lint / unit | PASS | At completion of this change: `npx tsc --noEmit` clean; `npm run lint` clean; `npm test` **65/65** |
| Existing e2e | PASS | `requirements.spec.ts` 4/4 (incl. "home page renders the SahFund product, no console errors") |

**Later runs re-run during the session picked up two failures from other in-flight, uncommitted parallel work — neither is a regression from this change:**

- `tsc` → `src/app/dashboard/transaksi/page.tsx: Cannot find module './transaction-actions'` — that directory is untracked (`??`) and mid-write; the file it imports does not exist yet.
- `npm test` → 73/74, `core.test.ts:40 parseRupiahMinor … expected -75000000, actual -5000000` — `parseRupiahMinor` is a +37-line addition to `src/core/money.ts` made by another session *after* this change's clean run (the 9 extra tests were not present at that time).

Lint stays clean (`exit 0`) throughout. This change touches only `src/components/landing/faq.tsx` and `src/components/landing/reconcile-demo.tsx`.

**Deferred (per design, not a gap):** the ≤ 1.5 s p95 measurement needs a preview deploy — M5 dogfood, per design.md Risks.

**Not run:** `full-flow.spec.ts` failed at `createWorkspace` (`/dashboard` instead of `/w/<id>`) — an environment issue, see note below. It failed on workspace creation, before reaching the US-44/US-56 404 assertion at `full-flow.spec.ts:109`.

> **Environment note:** the dev server on `:3000` runs without `E2E_LOCAL_DB=1`, so `next.config.ts` passes `remoteBindings: true` and — because `wrangler.jsonc` has `"remote": true` — it writes to the **production** `sahfunddb`. Sign-ups made during this verification did not land in the local Miniflare D1 (confirmed by scanning `.wrangler/state/.../*.sqlite*`: absent). Migration `drizzle/0004_bent_secret_warriors.sql` is untracked and is the likely cause of the `full-flow` failure. Run e2e only via `npm run test:e2e`, which sets `E2E_LOCAL_DB=1`.
