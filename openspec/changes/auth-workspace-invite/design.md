## Context

**As-built today** (verified in-repo, `feat(auth)` + migrations 0000–0003):

- `POST /api/auth` is a hand-rolled single boundary for sign-up and sign-in (Zod-validated, Better Auth called via `auth.api.*`, session cookie relayed). It redirects to `shortcut: "/"` and uses a **per-isolate in-memory `Map`** limiter (`src/lib/auth/rate-limit.ts`).
- `src/lib/session.ts` exposes `getSession()` / `requireSession()` — **called by nothing yet**; no protected page exists (`/dashboard`, `/w/:id`, workspace, join, invite screens are all absent). No sign-out endpoint, no `src/proxy.ts`.
- Schema already enforces the invariants these stories lean on: `members UNIQUE(userId)`, `members UNIQUE(workspaceId, role)` + role CHECK, `workspaces.inviteCode UNIQUE`, `workspaces.ownerId UNIQUE`, `categories UNIQUE(workspaceId, name)`; `rate_limits(key, windowStart, count, expiresAt)` exists (migration 0003) and is inert. No constraint-violation classifier exists in `src/lib/db/index.ts` yet (P3 says it must live there).
- `src/lib/db/index.ts` is the only driver module; D1 has **no interactive transactions** — `db.batch()` is the atomic primitive (AGENTS §2).

**Constraints this design must satisfy:** BRD FR-01/FR-02/FR-13 (incl. "no separate invite record"), NFR-01 (no files), NFR-02 (10/min/IP, 10/hour/workspace), NFR-03 (integer minor units); AGENTS §3 (DB is the invariant enforcer, no check-then-act, no member counting), §4 (workspace-scoped queries, no N+1), §6 (server components, shared Zod, four UI states, BI copy, a11y), §9 (session in handler, `proxy.ts` is not the boundary), §10 (no KV/R2/cron/OCR/LLM), P1–P8 (dialect confined; raw SQL allowlist; app-side timestamps); ITA §11.9 (never log codes, emails, or row contents); ITA §4.1 (`src/lib/mail.ts` = Resend via `fetch`, `src/proxy.ts`).

**Decisions already made upstream** (`docs/brainstorms/2026-11-05-…`): rate-limit storage = D1 table (decided); `invite_tokens` = BRD-blocked, not designed here; `guest_sessions` = out (stateless cookie idea not part of this change); refresh tokens = out.

## Goals / Non-Goals

**Goals:**
- Make the ten stories' acceptance criteria pass end-to-end: US-01–US-04 (auth/session), US-05–US-08 (workspace), US-52–US-53 (invite email + join link).
- Fleet-wide NFR-02 limits backed by `rate_limits`, with denied attempts not writing and no raw SQL outside the one documented allowlist extension.
- Every invariant backed by a DB constraint; handlers only translate violated constraints into the stories' clear Bahasa Indonesia messages.
- Resend integration that degrades to the mandated manual fallback with zero new dependencies.

**Non-Goals:**
- `invite_tokens` / TTL / expiring links / invite statuses (BRD FR-13: no separate invite record; B-11 stays open).
- Guest sessions or guest cookies; refresh-token/session-lifetime work (Q1 open).
- Import, ledger, reports, forecast, entitlement, deletion epics — only the dashboard *shell*, the wedding-date prompt, and the settings surfaces these ten stories need.
- Join-attempt rate limiting (not in NFR-02 — flagged as a BRD follow-up in Open Questions).
- Mounting Better Auth's catch-all handler (`[...all]`), email verification, OAuth, roles beyond owner/member.
- Any edit to BRD/ITA/ERD/USER-STORIES.

## Decisions

**D1 — Keep the as-built single auth boundary; add a narrow sign-out route.**
Sign-up/sign-in stay on `POST /api/auth`; sign-out becomes `POST /api/auth/sign-out` calling `auth.api.signOut` and relaying the cleared cookie (same relay pattern as sign-in). *Alternatives:* (a) mount `src/app/api/auth/[...all]` per ITA §4.1 — rejected for now: it exposes every Better Auth endpoint at once (brainstorm §3.3 "auth-surface widening" is a security-review decision, not a wiring detail) and no story requires it; (b) `mode: "sign-out"` inside the existing route — rejected: sign-out is not an auth *attempt* and must not consume the NFR-02 auth budget. The ITA §4.1 `[...all]` row is a doc-vs-code divergence → Open Question 1.

**D2 — Mutations live under `/api/*`; pages own their BRD paths.**
`POST /api/workspaces`, `POST /api/join`, `POST /api/workspaces/[id]/{rotate,details,invite}`; pages at `/workspaces/new`, `/join`, `/dashboard`, `/w/[workspaceId]`. *Rationale:* consistent with as-built `/api/auth`; BRD FR-01/02/13 path blocks read as behaviour contracts (the as-built auth path already diverges); avoids fighting Next 16 file-convention conflicts between `page.tsx` and `route.ts` in one segment (implementers confirm against `node_modules/next/dist/docs/` per `apps/frontend/AGENTS.md`). *Alternative:* literal BRD paths (`POST /workspaces` etc.) — possible as a rename, kept as Open Question 2.

**D3 — One D1-backed limiter replaces the `Map`.**
`src/lib/auth/rate-limit.ts` keeps its name and `clientKey()` but stores counters in `rate_limits`: app-side fixed window (P6 — no SQL `now()`), keys `ip:<addr>` (auth, 10/60 s) and `ws:<id>` (invite, 10/3600 s), **single atomic upsert** `INSERT … ON CONFLICT(key, windowStart) DO UPDATE SET count = count + 1 WHERE count < limit` so allowed attempts increment exactly once and denied attempts write nothing; expiry derived at read; piggyback `DELETE … WHERE expiresAt <= ?` on the write path (brainstorm §2.4 — no cron). Limiter failure (D1 unreachable) **fails open with a logged warning** (route, status, no row contents): a dead DB already produces the handler's explicit 503, and blocking sign-in on limiter error adds no security the auth path doesn't already lose. *Alternatives:* keep the Map as fallback — rejected (two implementations, DRY §7, still per-isolate); read-then-increment — rejected (loses increments under concurrency; the conditional upsert is atomic); Cloudflare `ratelimit` binding — rejected (cannot key by workspace; outside app portability rules). The in-memory `Map` and its tests are deleted, not kept alongside.

**D4 — The `count = count + 1` fragment is the third P1 allowlist entry, declared loudly.**
The increment expression is exported as the single documented fragment in `src/lib/db/schema.ts` (whose header already declares itself "the constraint/default allowlist of rule P1"), the header gains one sentence naming it, and root `AGENTS.md` P1's allowlist sentence is extended in the same task — an explicit, reviewable one-line extension, not a silent slip. Drizzle's `onConflictDoUpdate` `set` requires an SQL expression, so no-builder alternatives do not exist. Everything else (reads, windows, sweep) stays in the Drizzle query builder.

**D5 — Constraint violations are classified once, in `src/lib/db/index.ts`, and translated by message only.**
New typed classifier (P3: the only module that touches driver errors) maps `UNIQUE constraint failed: <table>.<column(s)>` to `{ kind: "unique", table, columns }`. Handlers then map: `members.userId` → "sudah tergabung" refusal; `members.workspaceId, members.role` → full-workspace refusal; `members` PK / `members.userId` where the read shows the *same* workspace → "already a member of this workspace". The disambiguating read happens **only after** the constraint has already refused the write (it picks a message; it never decides correctness — AGENTS §3). No member counts, no pre-insert "slot reservation".

**D6 — Write shapes.** Create workspace = one `db.batch()` [insert `workspaces`, insert `members` owner] — atomic, so a refused membership leaves no orphan workspace. Join = single `members` insert (the constraint is the transaction). Rotate / details = single update. Invite send = one `db.batch()` for the rate-limit upsert committed **before** the email attempt (FR-13: the email is a side effect after the write, never inside it). No `db.transaction()` anywhere.

**D7 — Pocket code: one pure module, CSPRNG, shared validation.**
`src/core/pocket-code.ts` (P4-pure): format validator (regex for 4 digits + 3 letters + 3 alphanumeric, exactly 10 chars) exported for the shared Zod schema — so the join form rejects malformed codes **before any lookup or write** (US-06) — plus generation from an injected/global CSPRNG, unit-tested for format and rejection cases. Generation does not pre-check uniqueness: on the astronomically unlikely `workspaces.inviteCode` unique violation the handler retries once with a fresh code, then answers the generic 503 (never a silent failure, never a duplicate).

**D8 — Redirects and `next`.** Sign-up → `/workspaces/new` (US-01). Sign-in → `/dashboard`, or a caller-supplied `next` **only** when it is a same-origin relative path (starts with `/`, not `//`, no scheme) — this is what lets US-53 survive the sign-in detour. Sign-out → `/login`. `next` is validated server-side (never trusted from the client), and sign-up ignores it (US-01's direction wins — see Open Question 4).

**D9 — Resend via `src/lib/mail.ts`, plain `fetch`.**
POST `https://api.resend.com/emails` with `Authorization: Bearer $RESEND_API_KEY`, text-only Bahasa Indonesia subject+body carrying only the pocket code, the join link (`/join?code=…`) and explanatory copy — no financial data, no attachments (NFR-01), no recipient or code in any log (ITA §11.9, FR-13). Missing/invalid key, non-2xx, or network failure → typed failure → response `fallback`; the invite itself is untouched. Timeout bounded (≈5 s) so a hung API cannot hang the route. *No SDK* — AGENTS §1 never adds a dependency for a few lines; ITA §4.1 already names this module.

**D10 — Owner-only surfaces.** Rotation (US-07 explicit) and invite send (US-52 "owner session") check `members.role = 'owner'` for the caller's membership row, scoped by `workspaceId`; non-owner → clear refusal, code unchanged. Hiding the affordance in the UI is UX only (§9). Wedding date/budget edits stay member-wide (US-08 says "a member").

**D11 — Dashboard scope is a shell.** `/dashboard` = `requireSession` → resolve membership → redirect `/w/:id`, or render the create-workspace prompt when the user has no workspace. `/w/[workspaceId]` = membership-guarded shell with loading / empty / error+retry / success states, the wedding-date prompt when `weddingDate` is null (US-05), and entry points to invite/settings; ledger/report/forecast bodies belong to later epics (the token reservation in `globals.css` already says so). Non-member access renders not-found without data (page) or 404 (API) — no existence disclosure.

**D12 — `src/proxy.ts` (Next 16) is cookie-presence convenience only.** Redirects requests lacking a session cookie for `/dashboard`, `/w/*`, `/workspace/*`; explicitly commented as never the authorization boundary (ADR-11, CVE-2025-29927 class). `/join` stays reachable signed-out so the code can pre-fill. File location and API confirmed against `node_modules/next/dist/docs/` (16 changes conventions — `apps/frontend/AGENTS.md`).

**D13 — Forms follow the as-built pattern.** Server components render pages; small `"use client"` leaves own form state, validate with the *same* Zod schema object on submit, disable submit while in flight, render the server's message verbatim in Bahasa Indonesia, and `router.refresh()`/`revalidatePath` after mutation. Money/dates go through `src/core/money.ts`. No `useEffect` fetching, no global store.

## Risks / Trade-offs

- [Read-then-write race on the invite window could overshoot 10] → the conditional upsert makes increment-and-cap one atomic statement; with a two-member cap the exposure is a handful of concurrent sends, not an attacker lever.
- [Attacker-influenced D1 reads/writes on the auth path (quota burn)] → denied attempts do not write; sweep rides writes; the volumetric first line stays the Cloudflare edge (brainstorm Q11, out of scope here).
- [Limiter fails open] → accepted and logged; DB-down already yields the explicit 503 from the handler itself (NFR-07); documented so nobody mistakes it for fleet-wide enforcement during an outage.
- [P1 allowlist creep] → exactly one fragment, named in schema.ts header **and** AGENTS P1 in the same task; any further raw SQL in review is a defect.
- [Post-violation disambiguation adds a read] → error path only; correctness never depends on it (D5).
- [Invite-code insert collision] → single retry then 503; no pre-check loop.
- [No join-attempt rate limit (NFR-02 is silent)] → CSPRNG code space + format constraint; recommend a BRD follow-up — not implementable as policy without a BRD edit (Open Question 5).
- [Sign-up from an invite link lands on workspace creation (US-01) and could strand a newcomer] → the create page offers a "punya kode undangan?" path to `/join`; full resolution is Open Question 4.
- [Doc-vs-code endpoint divergence (BRD/ITA paths vs as-built)] → D1/D2 record the behaviour-preserving reading; no doc is edited here; escalated as Open Questions 1–2 per AGENTS "code and docs disagree → stop and ask".
- [Windows clock skew across isolates] → window bounds derived from the request's app-side `Date.now()`; skew of seconds is irrelevant to 1-minute/1-hour windows.

## Migration Plan

No schema change: migrations 0000–0003 are applied locally and `rate_limits` already matches this design, so there is nothing to expand or contract. Deploy is an ordinary Workers/OpenNext release; rollback is a redeploy of the previous version (old code never touches `rate_limits`, new code needs no migration the old build would break). `RESEND_API_KEY` (+ sender address) is added later via `wrangler secret put` / `.dev.vars`; its absence must not fail deploy or build — the fallback path (D9) is the tested default. Rate-limit rows are ephemeral and swept on write; no backfill, no cron.

## Open Questions

1. **Auth endpoint of record:** keep the as-built `POST /api/auth` single boundary (D1) or mount ITA §4.1's `api/auth/[...all]`? Needs an ITA/BRD reconciliation note — not edited by this change.
2. **Endpoint paths:** accept `/api/workspaces|/api/join|/api/workspaces/[id]/*` (D2) as the implementation of FR-01/02/13, or hold out for the literal BRD paths?
3. **Resend sender:** which verified domain/address goes in `RESEND_FROM` (e.g. `SahFund <invite@sahfund.id>`)? Required before `status: sent` works in production; irrelevant to the fallback path.
4. **Sign-up from a join link:** keep US-01's unconditional redirect to workspace creation (current plan: create page links onward to `/join`), or let a `next` join target survive sign-up so an invited newcomer joins directly?
5. **Join-attempt rate limit:** add to NFR-02 (BRD edit) or rely on the CSPRNG code space for v1.0?
