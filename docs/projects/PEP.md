# Project Execution Plan — SahFund

**Version:** 0.1
**Date:** 2026-Nov-02
**Status:** Draft
**Derived from:** BRD v0.1, ITA v0.1 (`specs/wedding-fund/`)

---

## 1. Project Overview

Deliver the v1.0 MVP defined by BRD §3 — two-member workspace with invite by email (Resend) or pocket code, Jago and CSV import, reconciliation, categorisation, attribution, commitments, forecast, one-time entitlement — in seven working days, solo with agent assistance. The single biggest risk is not the code: it is that the parser has been proven against a fixture derived from a published example, not against a real exported statement, so the first real document may reveal a layout nobody has seen yet.

| | |
|---|---|
| **Target release** | v0.1.0 — 2026-Nov-10 (7 working days from kickoff) |
| **Delivery mode** | solo + agent-assisted |
| **Overall confidence** | medium — architecture settled, one unvalidated input (the real statement) |

Estimates in §4 total roughly 9.7 days against a 7-day target. That gap is deliberate and visible: §10 fixes the cut order now, so slippage is a decision made in advance rather than a panic on day seven.

---

## 2. Roles

| Role | Who | Owns |
|------|-----|------|
| Product owner | Uwi | scope calls (BRD amendments) |
| Technical lead | Uwi | architecture calls (ITA ADRs) |
| Delivery lead | Uwi + agent standup | plan, risks, cadence (this doc) |
| QA | Uwi | acceptance against §7 gates |

---

## 3. Milestones & Phases

| Phase | Deliverable | Duration | Exit criteria | Status |
|-------|-------------|----------|---------------|--------|
| M1 — Foundation | Deployed skeleton: auth, workspace, invite, schema, CI | ~1.5d | Two accounts join one workspace on a preview URL; `/api/health` returns `db: up` | ⬜ |
| M2 — Import | Client-side extraction, adapters, reconciliation, dedupe | ~2.5d | A real redacted statement imports and reproduces the bank's closing balance | ⬜ |
| M3 — Reporting | Ledger, categories, attribution, budget, commitments, forecast | ~2.5d | A partner can read the report without a walkthrough | ⬜ |
| M4 — Monetisation & hardening | Entitlement, pricing page, rate limits, deletion, e2e | ~1.25d | A stranger can pay and get access with no manual step | ⬜ |
| M5 — Release gate | Dogfood, fix list, tagged production deploy | ~0.75d | 48 hours of real use, then a production deploy with a rehearsed rollback | ⬜ |

M1–M4 map one-to-one to BRD §7. M5 is the release gate, not a fifth product phase.

---

## 4. Work Breakdown

### M1 — Foundation
- [ ] Project scaffold: pinned versions from ITA §3, Tailwind v4 tokens, shadcn init — Uwi — ~0.25d
- [x] D1 database + wrangler D1 binding + OpenNext config (D1 task c: `wrangler d1 create`, `wrangler.jsonc` `d1_databases` with binding `env.DB`, `initOpenNextCloudflareForDev()` for a local simulated D1) — Uwi — ~0.5d
- [ ] Drizzle schema (sqlite dialect) + first migration applied with `wrangler d1 migrations apply` — Uwi — ~0.25d
- [ ] Better Auth wiring, login/signup pages, `requireSession()` guard — Uwi — ~0.5d
- [ ] Workspace create + pocket code (10-char) + invite email via Resend + join flow (max two members) — Uwi — ~0.35d
- [ ] OpenNext deploy to Workers + `/api/health` — Uwi — ~0.25d
- [ ] CI: typecheck, unit tests, schema drift check — agent — ~0.25d

**D1 follow-up (ADR-13) — code and doc tasks for the specialist after this plan is signed off** (binding setup is D1 task c, the first M1 row above; implementation detail in `SPEC-d1-migration.md`):
- [x] Swap the DB client to D1 (D1 task a): `src/lib/db/index.ts` → lazy client over `drizzle-orm/d1` + the `env.DB` binding, keeping `probeDb()`'s 3 s bound and the health route unchanged — agent — ~0.25d
- [x] Remove/evaluate Neon dependencies (D1 task b): drop `@neondatabase/serverless` (plus `@neon/config`, `@neon/env`, `apps/frontend/neon.ts`, `.neon/`), rewrite `.env.example` (no connection-string vars), prune the lockfile — agent — ~0.1d
- [x] Sync `AGENTS.md` to D1 (D1 task d): §1 stack + Neon-skills block + portability rules P1–P8, §2 hard constraint and migrations line, §3 constraint-error wording (`SQLSTATE 23505` → `SQLITE_CONSTRAINT_UNIQUE`), §10 D1 exclusion lifted, §11 integration target; also index `SPEC-d1-migration.md` in `docs/README.md` — agent — ~0.25d
- [x] Sync ERD.md from ITA §5 (D1 task e) — status note, type/money conventions, constraint-error wording and the open SQLSTATE question now match the as-built SQLite/D1 schema — agent — ~0.15d
- [ ] Evaluate the Neon skills in the repo (D1 task f): `skills-lock.json`, `.agents/skills` — keep only what still applies (expected: none for DB work) — agent — ~0.05d

> **As-built notes from the T8 doc sweep (where reality differed from the task text):**
> - **Money columns are `numeric({ mode: 'bigint' })`, not `integer({ mode: 'bigint' })`** — Drizzle's SQLite `integer()` has no bigint mode (0.45.4); `numeric` has NUMERIC affinity and reads back as a JS `bigint`. `AGENTS.md` §1 P5 and `ITA §5` now state the working form.
> - **Task f is incomplete:** the nine `.agents/skills/neon-*` packages (SKILL.md + references) are still on disk. Both `.agents/` and `skills-lock.json` are gitignored machine-local tooling; the neon-* lock entries were removed in this pass, but the directories still need deleting (and must not be restored from a global install for DB work).

### M2 — Import
- [ ] Port proven core (money, adapters, reconciliation) into the app — Uwi — ~0.25d
- [ ] pdf.js extraction page, worker wiring, main-thread fallback — Uwi — ~0.5d
- [ ] Import preview: pocket picker, reconciliation banner, duplicate count — Uwi — ~0.5d
- [ ] `POST /imports`: Zod validation, `db.batch()` insert, dedupe hash — Uwi — ~0.5d
- [ ] Validate against a real redacted statement and extend fixtures — Uwi — ~0.5d
- [ ] Generic CSV path surfaced in the UI — Uwi — ~0.25d

### M3 — Reporting
- [ ] Ledger: list, date/category/member filters, search — Uwi — ~0.5d
- [ ] Category seed, bulk assign, payee→category rules — Uwi — ~0.5d
- [ ] Contribution attribution and per-member totals — Uwi — ~0.5d
- [ ] Budget vs actual and commitments (DP/pelunasan) — Uwi — ~0.5d
- [ ] Forecast and read-only share link — Uwi — ~0.5d

### M4 — Monetisation & hardening
- [ ] Entitlement: license code or Lynk.id order grant + gating — Uwi — ~0.5d
- [ ] Rate limits, error tracking, health check alerts — Uwi — ~0.25d
- [ ] Privacy policy, terms, account/workspace deletion — Uwi — ~0.25d
- [ ] Playwright happy path on preview — agent — ~0.25d

### M5 — Dogfood & release
- [ ] 48 hours of real use on the founder's own pocket — Uwi — ~0.25d
- [ ] Fix list from dogfood, triaged against §10 — Uwi — ~0.25d
- [ ] Production release + rollback rehearsal — Uwi — ~0.25d
- [ ] Verify the D1 Time Travel window against BRD NFR-06's 30-day purge at release — Uwi — ~0.05d

---

## 5. Timeline

```
Day:     1     2     3     4     5     6     7
M1      ████
M2            ███████
M3                    ███████
M4                            ████
M5                              ███
QA      ·     ·     ·     ·     █     ██
```

Days 5–7 carry QA continuously rather than as a separate phase; there is no week two to catch up in.

---

## 6. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Trigger to act |
|---|------|-----------|--------|------------|----------------|
| R1 | The real statement layout differs from the derived fixture | H | M | Obtain one redacted statement on day 1, before M2 starts; if text order defeats the parser, switch to pdf.js coordinate mapping | Parser fails on the first real document |
| R2 | D1 cannot do interactive transactions | M | M | Use `db.batch()` for import + rows; D1's batch is documented as atomic — verify with a forced mid-import failure | Any partial import observed |
| R3 | OpenNext / Next 16 peer drift or build break | L | H | Pin exact versions; deploy the empty skeleton on day 1 before feature work | Preview build fails |
| R4 | Better Auth schema drift | M | M | Generate with the CLI, diff against `schema.ts`, migrate | Auth queries fail after an upgrade |
| R5 | No payment entity for Midtrans/Xendit | H | M | Ship Lynk.id license codes or manual grants; entitlement is not a dogfood blocker | Day 5 with no provider |
| R6 | Scope creep ("while we're here": wedding invitations, guest list) | H | H | BRD §3 out-of-scope list is contractual; every request becomes a v1.1 ticket. Note: *partner* invitation email (BRD FR-13) is in scope — this risk means wedding invitations/RSVP, not member invites | Any feature not in BRD §4 |
| R7 | Statement data leaking into logs or a third-party service | L | H | No document storage; no amounts/descriptions in logs; review every log call | Any PII in Workers Logs |
| R8 | Price rejection at Rp 49.000 | M | M | Ten-customer test before any ad spend; adjust to Rp 79.000 only with evidence | Fewer than 5 paid in the first cohort |

---

## 7. Quality & Testing Strategy

| Level | What | Tool | Gate |
|-------|------|------|------|
| Unit | Rupiah parsing, date formats, both adapters, reconciliation including a tampered amount | `node:test` | Green in CI; one fixture per statement layout |
| Integration | Import → persist → report; re-import the same month | `node:test` + local D1 (Miniflare via wrangler) | Zero duplicate rows; totals unchanged |
| E2E | Signup → workspace → invite → import → report | Playwright on preview | Green before M4 is done |
| Manual | One real redacted statement per release; deletion actually deletes | Checklist | Signed off before production deploy |

**Definition of done for every milestone:** deployed to preview, CI green, exit criteria in §3 demonstrated, and no known unreconciled import in the demo workspace.

---

## 8. Release Plan

- Channels: preview Worker per pull request; production on a `v0.1.0` tag.
- Versioning: semver for the app, date-stamped Worker versions for rollback granularity.
- Rollout: deploy → `/api/health` asserts `db: up` → smoke import into a test workspace → announce.
- Migrations: expand/contract only. No destructive migration ships in the same deploy as the code that stops using the column.
- Rollback: `wrangler rollback` to the previous Worker version; database stays compatible by construction.
- Data: no production data is copied into preview. Local D1 state and the `sahfund-preview` database are disposable.

---

## 9. Cadence & Communication

| Ritual | When | Output |
|--------|------|--------|
| Status check | Start of each working day, 15 minutes | Phase table above updated; blockers named |
| Demo / review | End of each milestone | Working increment on a preview URL |
| Retro | After M5 | Lessons → `journal/`, reusable procedure → skill |

---

## 10. Change Control

Scope changes need a BRD amendment and an updated risk/timeline row here; a technical change needs an ITA ADR first. No feature enters mid-milestone.

**Fixed cut order if the week slips** — decided now, executed top-down, no debate:

| Order | Cut | Consequence |
|-------|-----|-------------|
| 1 | Share link (M3) | Family reads the report over the owner's shoulder for a week |
| 2 | Pricing page (M4) | First ten customers are invoiced manually |
| 3 | CSV adapter in the UI (M2) | CSV remains available to the founder only |
| 4 | Payee rules (M3) | Categorisation is manual until v1.1 |

**Never cut:** reconciliation, deletion, Jago import, server-side session checks. Those are the product and its legal floor.

---

## 11. Assumptions, Dependencies, Constraints

| Type | Statement | If false |
|------|-----------|----------|
| Assumption | A real, redacted Jago statement is available on day 1 | R1 fires; allow +1 day and use the coordinate-mapping path |
| Assumption | Customers can export a monthly e-statement from the Jago app | The product needs a different ingestion story; stop and re-plan |
| Assumption | Two members per workspace is enough for v1 | Membership limit moves to v1.1 with roles |
| Dependency | Cloudflare account with Workers enabled | Deploy target changes; ITA ADR-01 revisited |
| Dependency | Cloudflare D1 database with the `env.DB` binding (ADR-13) | Missing binding fails fast with the explicit 503; recover data with Time Travel (30 days paid / 7 days free) or `wrangler d1 export` |
| Dependency | Payment provider decision by day 5 | Manual invoicing for the first cohort |
| Dependency | Resend account + verified sender domain (`RESEND_API_KEY`) | Invite email falls back to the copy-code/link path of FR-13 (join by pocket code still works); no user is blocked |
| Constraint | Seven working days, one developer | §10 cut order applies |
| Constraint | No document or image storage | Removes OCR and any "just upload a photo" request from scope |
| Constraint | Bahasa Indonesia UI, IDR only | No localisation work beyond `id-ID` formatting |

---

## 12. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product owner | Uwi | | |
| Technical lead | Uwi | | |
| Delivery lead | Uwi | | |
