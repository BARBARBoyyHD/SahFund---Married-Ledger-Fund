# Brainstorm — Refresh tokens, per-user rate limits, invite tokens

**Date:** 2026-11-05 · **Status:** exploration only — no decisions made, no code written
**Trigger:** three informal ideas ("refresh token", "rate limit by user id — do we need a new db??", "Discord-style invite token table with statuses + TTL")
**Sources checked:** root `AGENTS.md`, BRD/ITA/ERD/USER-STORIES/PEP/SPEC-d1-migration, `apps/frontend/src/lib/auth/*`, `src/app/api/**`, `src/lib/db/schema.ts`, Better Auth 1.7.15 sources in `node_modules/better-auth/dist`.

---

## 0. TL;DR — "Do we need a new db?"

| Idea | New datastore? | Short answer |
|---|---|---|
| 1. Refresh token | **No** | The `session` table already exists and Better Auth already slides it. What is missing is configuration + a cookie-refresh path, not storage. |
| 2. Rate limit by user id | **No** | At most **one new table inside the same D1 database** — or a Cloudflare-managed rate-limit binding (platform primitive, not a db). KV is the textbook answer and it is banned (AGENTS §10). |
| 3. Invite token table | **No** | One new D1 table (or, in the cheapest option, one new column on `workspaces`). The blocker is **BRD scope**, not storage. |

Two facts that reframe all three ideas:

- **The invite/join flow does not exist yet.** `src/app/api` contains only `/api/auth` and `/api/health`; PEP M1's "Workspace create + pocket code + invite email + join" row is unchecked. The invite-token decision happens **before** the code is written — the cheapest possible moment (no migration, no data, no tests to rewrite).
- **SPEC-d1-migration B7 says auth limits are "enforced at the Cloudflare edge" — the code enforces them in an in-process `Map`** (`rate-limit.ts`, with a `shortcut:` comment admitting the per-isolate caveat). Per AGENTS ("if code and docs disagree, stop and ask") this is flagged below as open question #7, not silently resolved.

---

## 1. Idea 1 — "We need to implement refresh token as well"

### 1.1 Current state (what already works)

| Piece | State |
|---|---|
| `session` table | Exists: `id, expiresAt, token (unique), userId…` (`schema.ts`; ITA §5, ERD §5) |
| Session config | **Not set** — `auth.ts` passes no `session` block, so Better Auth defaults apply: `expiresIn = 604 800 s (7 days)`, `updateAge = 86 400 s (24 h)` (`node_modules/better-auth/dist/context/create-context.mjs:147-148`) |
| Sliding refresh | **Built in.** On `get-session`, Better Auth rewrites `expiresAt = now + expiresIn` once the session is older than `updateAge` (`dist/api/routes/session.mjs:178-214`). `getSession()`/`requireSession()` (`src/lib/session.ts`) call this path server-side, so the **DB row already slides**. |
| Cookie lifetime | Set once at sign-in with `maxAge = expiresIn` = 7 days (`dist/cookies/index.mjs:49`). Nothing re-emits `set-cookie` afterwards — `session.ts` discards the returned headers, and server components cannot set cookies during render anyway. |
| Client refresh endpoint | **None.** There is no mounted Better Auth handler (no `[...all]` route, no `authClient`) — `/api/auth` is a hand-rolled POST boundary for sign-up/sign-in only. The browser therefore **cannot** refresh the session cookie today. |
| `account.refreshToken` / `accessToken` columns | Exist (generated Better Auth schema), but v1.0 is email+password only (`auth.ts` comment "No OAuth (BRD FR-01)"; BRD §3 in-scope). Better Auth's `/refresh-token` endpoint rejects non-social accounts (`PROVIDER_NOT_SUPPORTED`, `dist/api/routes/account.mjs:476-479`). |

**Net current behaviour:** a user is effectively logged in for **7 days, fixed** — the DB row would slide, but the cookie dies at day 7 and no endpoint exists to renew it.

### 1.2 What "refresh token" could mean here (must be disambiguated)

- **(a) Stay logged in longer / sliding sessions** — most likely reading. Mostly config + wiring.
- **(b) Rotating session credentials** (old token invalidated on each refresh) — Better Auth updates `expiresAt` but keeps the same `token`; rotation is not built in for DB sessions and would be custom code. No doc requires it.
- **(c) OAuth provider refresh tokens** — columns exist, providers do not. Adding OAuth is a BRD §3 scope change; nothing to build until then.

### 1.3 Options

**Option A — Config only (accept fixed login lifetime, tune it).**
Set `session: { expiresIn, updateAge }` in `auth.ts`. E.g. `expiresIn: 30d` → cookie and DB both live 30 days, re-login monthly.
- ✅ Smallest possible change; no new routes; matches ITA §4.2 (auth.ts owns "session lifetime").
- ❌ Still a hard cut-off — no true sliding beyond the configured window; user re-logs in every N days.

**Option B — Config + wire an end-to-end refresh path.**
Set `expiresIn`/`updateAge`, **and** give the browser a way to renew the cookie: either (B1) mount the standard Better Auth catch-all handler (`auth.handler`) so `get-session`/`sign-out` work and a client call re-sets the cookie, or (B2) add a `GET` mode to the existing single-boundary `/api/auth` route that relays `set-cookie` from `auth.api.getSession` (same relay pattern the POST handler already uses for sign-in).
- ✅ True sliding sessions: active users never re-login; idle timeout = `expiresIn`.
- ❌ B1 widens the exposed auth surface (every Better Auth endpoint goes live — sign-out, revoke, account endpoints) and cuts against the repo's deliberate "one boundary for both auth modes" design (`route.ts` docblock); B2 is custom but keeps the surface small.
- ⚠️ Server components can never do this (Next forbids cookie writes during render) — refresh must live in a route handler or a client call.

**Option C — Rotating tokens (reading (b)).**
Custom rotation on refresh: new `token` per renew, old invalidated.
- ✅ Limits the value of a stolen cookie.
- ❌ Extra complexity with no requirement behind it; concurrent requests from two tabs can race the rotation and log users out; no BRD/ITA line asks for it.

### 1.4 Recommendation (hypothesis)

**Start with Option A, structure the code so Option B is a small follow-up.** Rationale: the actual gap is "users get logged out after 7 days", which a config value may settle on its own; B is real work (new endpoint + client call + tests) that should only be bought if the team decides sliding sessions are worth an auth-surface decision (B1 vs B2 is itself an open question). Rotation (C) and OAuth (c) have no requirements behind them in v1.0. **BRD note:** FR-01 specifies no session duration — if a value like "stays logged in 30 days" is user-visible, it deserves one line in FR-01 (BRD change, trivial).

---

## 2. Idea 2 — "Rate limit based on their id — do we need a new db??"

### 2.1 Current state

- `src/lib/auth/rate-limit.ts`: **in-memory `Map<string, number[]>`**, fixed 60 s window, 10 attempts, keyed by IP (`cf-connecting-ip` via `clientKey()`), capped at 10 000 keys. The file's own `shortcut:` comment states the truth: *the limit is 10/min/IP **per isolate*** — N isolates ⇒ N × the limit, and state resets on isolate recycle (fail-open).
- Used only by `POST /api/auth` (`route.ts:72`).
- Spec'd limits (BRD NFR-02): auth **10/min/IP** · import **20/hour/workspace** · invite email **10/hour/workspace**. Import and invite limits are **not implemented yet** (no import/invite routes exist) and are already keyed by **workspace**, not IP.
- **Better Auth's built-in rate limiter is inactive in this app.** It runs only inside the HTTP router (`dist/api/index.mjs:173`), and this app never mounts `auth.handler` — it calls `auth.api.*` directly, which bypasses it (`dispatch.mjs` contains no rate-limit call). Even if enabled, it keys by `IP + path` only, storage defaults to memory (or `database` via a `rateLimit` model, or `secondary-storage`), with a built-in rule of 3 attempts/10 s on sign-in paths (`dist/api/rate-limiter/index.mjs:305-318`). It cannot key by user id either.
- SPEC-d1-migration B7 / ITA §7 claim these limits are "enforced at the Cloudflare edge" — **the repo configures no WAF rate-limit rule** (nothing in `wrangler.jsonc`; WAF config lives outside the repo and could not be verified from here). See open question #7.

### 2.2 What would userId-keyed limiting actually add?

Enumerate the endpoints honestly:

| Endpoint | Identity available at the limit check | Current/spec'd key |
|---|---|---|
| `POST /api/auth` (sign-in/up) | **No userId yet** — pre-auth. Could key by *email*, but that lets an attacker lock a victim's account (DoS by burning their attempts) | IP (NFR-02) |
| Import | session → userId → workspace | workspace (NFR-02) |
| Invite send | session → workspace | workspace (NFR-02) |
| Join by pocket code (not built) | session → userId; the *code* is what is being guessed | **not in NFR-02 at all** |

Real value of a userId key: **it survives IP churn and shared IPs** (mobile CGNAT, botnets rotating IPs against one account — IP keys miss this), and it is spoof-proof. For the spec'd limits specifically, the heavy authenticated actions are *already* keyed by workspace, and with the two-member cap a workspace ≈ a couple ≈ the user unit — so a userId key adds little there. The genuine gap is **pre-auth sign-in brute-force of one account across many IPs** (email/account-keyed, complementary to the IP key — not a replacement, because account-keying alone enables victim lockout) and **join attempts** (currently unspecified entirely).

### 2.3 Where can the counter state live? (evaluated against AGENTS §1/§10)

| Store | Verdict |
|---|---|
| **In-memory (status quo)** | ✅ Zero cost, zero writes. ❌ Per-isolate multiplier (already documented as a `shortcut:`); useless as a *fleet-wide* guarantee; resets on recycle. |
| **New D1 table** (e.g. `rate_limits(key, windowStart, count)`) | ✅ Same database — **not a new db**. Fleet-wide, any key (IP/email/userId/workspace). Mechanism: single-statement upsert (`INSERT … ON CONFLICT DO UPDATE SET count = count + 1`, app-side window timestamp per P6 — no `now()` in SQL), atomic without interactive transactions (AGENTS §2), plus occasional prune. ❌ 1–2 D1 ops per attempt (reads are attacker-influenced — bounded by the limit itself, but note D1 Free's 100k writes/day); new schema + migration + unit tests. |
| **Cloudflare Workers rate-limit binding** (`[[ratelimit]]`, arbitrary key incl. userId) | ✅ Edge-global, no data stored by us, not KV. ❌ New infra primitive not in ITA §3's stack — needs an explicit decision; availability/plan to verify; nothing in the repo uses it today. |
| **Cloudflare WAF rate-limit rules** (what B7 seems to describe) | ✅ Truly at the edge, zero app code. ❌ Configured outside the repo; keys on IP/URI/headers — **cannot see a server-side userId**; cannot cover the account-keyed case. |
| **KV** | ❌ **Banned** — AGENTS §10: no KV/R2/server-side session cache in v1.0. If KV turns out to be genuinely required, that is a flagged BRD/ITA scope change, not a silent addition. |

**Plain answer to "do we need a new db?": No.** Not one byte of new *storage infrastructure* is required. The real choice is *shared counter in D1 (a table)* vs *platform-managed edge limiter* vs *keep the per-isolate Map and accept its documented weakness*.

### 2.4 Options

**Option A — Keep the in-memory IP limiter; document it as the v1.0 trade-off.**
The `shortcut:` comment already does this. Add nothing.
- ✅ Zero work. ❌ Fleet-wide limits are an illusion; no account-keyed protection.

**Option B — One shared D1 counter table, key chosen per endpoint (IP + account for sign-in; workspace for import/invite; IP for join).**
- ✅ Real fleet-wide enforcement, arbitrary keys, all inside the existing stack (P1–P8 satisfied: Drizzle only, one new table in `schema.ts`, migration via `drizzle-kit generate`).
- ❌ The most code of the three options; D1 write volume on a hot, attacker-influenced path; needs pruning logic and tests.

**Option C — Cloudflare-managed rate limiting (WAF rules for IP, Workers binding for account keys).**
- ✅ Zero D1 traffic, edge-global, offloads the whole concern.
- ❌ New platform surface outside ITA's documented stack; WAF cannot key on userId; config lives outside the repo (harder to review/test with the repo's tooling).

### 2.5 Recommendation (hypothesis)

**Decide the *abuse model* before the *store*.** If the concern is "one account attacked from many IPs", the missing piece is an **account-keyed sign-in limit** (complement, not replace, the IP key — and its threshold belongs in BRD NFR-02). Given v1.0 scale (BRD target: 1,000 workspaces, NFR-10 ≤ US$20/mo), **Option B (D1 table) is the simplest thing that is actually fleet-wide and stays inside the fixed stack**; Option A is defensible if the team consciously accepts the per-isolate caveat; Option C is worth it only if D1 write volume on the auth path ever becomes a measured problem. Any new or re-keyed limit ⇒ **BRD NFR-02 edit** (numbers and keys live there — do not invent silently).

---

## 3. Idea 3 — Invite token table with statuses + TTL ("like Discord")

### 3.1 Current state

- **Credential:** one static `workspaces.inviteCode` (10-char pocket code, UNIQUE) — **the** join credential (BRD FR-02; ITA §5; ERD §5). No separate invite record — **explicitly specified**: BRD FR-13: "The invite itself is the workspace's existing pocket code — there is no separate invite record."
- **Join:** `POST /join { inviteCode }` (FR-02) — **not built yet** (PEP M1 unchecked; only `/api/auth` + `/api/health` exist).
- **Email:** FR-13 (Resend) — **not built yet**; spec'd fallback behaviour: send failure never invalidates the invite; response `fallback`; UI shows code + link + retry (US-52).
- **Invalidation:** rotation only (US-07: rotate ⇒ previous code immediately invalid). **No TTL anywhere** — USER-STORIES **B-11** documents exactly this gap: an *expired* code error was expected, but "no document defines a TTL … it would need a stored invite record with its own expiry, which the current schema does not have."
- **Caps (unchanged by any option):** two members per workspace and one workspace per user are DB-enforced (`members UNIQUE(workspaceId, role)`, `UNIQUE(userId)` — ITA §5, AGENTS §3); the handler only maps constraint violations to messages.
- **Scope guard:** workspace-partner invites are **in scope** (BRD §3: "Invite a second member by email or by sharing the pocket code"). Digital wedding invitations / guest list / RSVP are **out of scope** (BRD §3; AGENTS §10) — this brainstorm touches neither.

### 3.2 The hard conflict

A token table **contradicts a current BRD sentence** (FR-13 "no separate invite record") and would answer B-11. AGENTS is unambiguous: code-vs-doc disagreement ⇒ **stop and ask**; scope changes go through the BRD. So option (b) below is not implementable as-is — it needs a BRD edit first. The good news: **no code exists yet**, so the edit costs a paragraph, not a migration.

### 3.3 Model options

**Option A — Keep `inviteCode`; give it TTL semantics (cheapest).**
Add `workspaces.inviteCodeExpiresAt` (nullable = never expires); rotation resets it; join compares against an app-side timestamp (P6 — no SQL `now()`). "Expired" becomes answerable (partially closes B-11).
- ✅ One column, one migration; FR-13 stays true; US-53 "the code alone is the credential" intact.
- ❌ Not Discord-style: no per-send record, no per-link revocation, no independent links, no audit trail; TTL on a *shared* credential is semantically odd (whose clock? — resets on rotation only).

**Option B — Discord-style per-link token table; `inviteCode` stays as the fallback credential.**
New table, e.g. `invite_tokens(id, workspaceId, token UNIQUE, expiresAt, createdAt, createdBy, usedAt?, …)` — one expiring link issued per send; owner can issue/revoke several; the pocket code continues to work until rotated (FR-02 manual path and US-53 unchanged).
- ✅ Matches the user's vision; per-send expiry and revocation; audit trail; answers B-11 properly; cheap *today* because nothing is built.
- ❌ Two coexisting credentials with different lifetimes (a link can die while the code lives) — needs clear UI copy; **requires FR-13 edit** + ITA §5 addendum + ERD sync; more surface (routes, Zod schemas, tests).

**Option C — Replace `inviteCode` with tokens entirely.**
- ❌ **Flagged, not recommended:** breaks FR-02, US-06 (enter the code), US-53 ("the code alone is the credential"), FR-13's mandatory manual-copy fallback, and the pocket-code format tests (ITA §11 test strategy). A BRD rewrite for no stated user benefit.

### 3.4 Status semantics — untangling "used / pending / failed"

| Proposed status | Analysis |
|---|---|
| `pending` | ✅ Issued, not yet consumed, `expiresAt > now`. |
| `used` | ✅ Consumed once. **Enforce one-time use in the DB**, not handler logic (AGENTS §3): candidates are `members UNIQUE(inviteTokenId)` (the membership row *is* the consumption; a second use fails on the index) or a conditional claim `UPDATE … SET usedAt WHERE token = ? AND expiresAt > ? AND usedAt IS NULL` whose row-count check is the atomic decision. Both writes (claim + membership insert) go in **one `db.batch()`** (AGENTS §2) — note the open ordering question in §6. |
| `expired` | ⚠️ **Do not store it — derive it**: `pending AND expiresAt < now` at read time. v1.0 has no cron/worker to flip stored statuses (adding one = new infra), and a stored `expired` goes stale the moment it is written. Same logic as Better Auth's own session handling (compare at read). |
| `failed` | ❌ **Semantically unclear — likely a trap.** If it means *email send failed*: FR-13 already mandates that send failure **does not invalidate** the invite (status `fallback`), so a `failed` *credential* status contradicts FR-13. If it means *join attempt failed*: that is an event, not a token state. **Recommend dropping `failed` as a token status**; if the user means "revoked by owner", name it `revoked`. |

Interaction with the caps: **unchanged and unaffected** — membership insert still fails on `UNIQUE(workspaceId, role)` under concurrency; the token mechanism never becomes the enforcement point for the cap (ITA §5 membership constraints).

Security hygiene (token **is** a credential, exactly like the pocket code): never logged, never echoed in errors (ITA §11.9, ITA §5 pocket-code paragraph, BRD FR-13/NFR-02); validated via shared Zod schema at the route boundary; join attempts should be rate-limited — **NFR-02 currently specifies no join limit**, so adding one is a BRD edit (open question #5).

### 3.5 The TTL value ("N") — belongs in the BRD, options only

B-11 says the value must be specced before code. Candidate shapes (no silent pick):

- **Fixed default:** 7 days (Discord's common default) · 24 hours (shorter, tighter) · 30 days (matches the product's low-urgency feel).
- **Per-send choices, Discord-style:** 30 m / 1 h / 6 h / 1 d / 7 d / never — flexible but more UI.
- **Max uses:** single-use (true "token") vs unlimited-until-expiry vs N uses. Note tension: a *single-use* link that dies while the pocket code still works is confusing; unlimited-until-expiry is closer to "code with an expiry".
- **Never-expires toggle** as an explicit option (keeps parity with today's behaviour).

### 3.6 Recommendation (hypothesis)

**Option B, decided now before M1's invite row is built — contingent on a BRD edit to FR-13 and a TTL/max-use answer (B-11).** Reasoning: the user's described behaviour (per-link expiry, states, Discord-like) is not expressible on the single shared code (Option A can only fake part of it); Option C breaks spec'd user stories; and the window where this is nearly free is *right now*, because the invite/join code, routes, and tests do not exist yet. `inviteCode` stays as the manual fallback (FR-13/US-53 keep working), `expired` is derived, `failed` is dropped or renamed `revoked`, and the two-member cap stays exactly as ITA §5 specifies. Synergy note: ERD §7.1 has the **same gap for FR-11 share-report tokens** ("needs an ITA §5 addendum before schema authoring") — if `invite_tokens` is built, the share-token table question should be answered in the same pass so both credential tables follow one pattern.

---

## 4. Scope classification (a) config of what exists · (b) normal v1.0 feature work · (c) BRD/doc changes

| # | Item | Class |
|---|---|---|
| 1a | `session.expiresIn` / `updateAge` in `auth.ts` | **(a) config** |
| 1b | Cookie-refresh path (GET `/api/auth` relay or mounted `auth.handler` + client call) | **(b) feature work** (B1/B2 is an architecture choice) |
| 1c | Session duration as a user-visible promise | **(c)** BRD FR-01 line (optional but recommended) |
| 1d | Rotating tokens / OAuth refresh tokens | out of v1.0 (no requirement; OAuth = BRD §3 scope change) |
| 2a | Keep in-memory limiter as-is | (a) nothing to do |
| 2b | D1 `rate_limits` table / edge binding / per-account or join limits | **(b) feature work** + infra decision for a binding |
| 2c | Any new limit number **or key** (IP→userId, join limit) | **(c)** BRD **NFR-02** edit (values live there) |
| 2d | SPEC B7 / ITA §7 "enforced at the Cloudflare edge" vs in-memory code | **(c)** doc-vs-code reconciliation (open question #7) |
| 3a | Option A: `inviteCodeExpiresAt` column | (b) after a small **(c)**: BRD TTL value (B-11) |
| 3b | Option B: `invite_tokens` table + routes | **(c) first**: BRD **FR-13** ("no separate invite record" sentence), **FR-02** wording if link semantics added, TTL/max-use value (**B-11**), optional join rate limit (**NFR-02**); then ITA §5 addendum + ERD sync; then (b) |
| 3c | Option C: replace `inviteCode` | (c) — **BRD rewrite; flagged, not recommended** |
| all | New dependency, KV, R2, background/cron job for expiry | ❌ excluded (AGENTS §1/§10) — derived expiry avoids the cron |

---

## 5. Comparison matrix

| Criterion | 1A config | 1B sliding | 2A keep Map | 2B D1 counter | 2C edge limiter | 3A TTL column | 3B token table |
|---|---|---|---|---|---|---|---|
| New datastore | none | none | none | **table in D1** | none (platform) | column | **table in D1** |
| New BRD edit | optional (FR-01) | optional (FR-01) | no | yes (NFR-02) if keys/numbers change | yes (NFR-02) | yes (TTL value) | **yes (FR-13 + TTL + …)** |
| Code cost | ~1 line | endpoint + client + tests | 0 | medium (upsert, prune, tests) | config outside repo | small | largest (but built once, now) |
| Fleet-wide correctness | n/a | n/a | ❌ per-isolate | ✅ | ✅ | n/a | n/a |
| Main risk | hard logout at N days | auth-surface widening (B1) | limits are advisory | D1 write volume on hot path | stack drift, untestable in repo | shared-credential expiry confusion | two coexisting credentials; status semantics |
| Fits AGENTS §1/§10 | ✅ | ✅ | ✅ | ✅ | ⚠️ new primitive | ✅ | ✅ (after BRD edit) |

---

## 6. Open questions for you (answerable directly)

1. **"Refresh token" — which did you mean?** (a) stay logged in longer / stop the 7-day re-login, (b) rotating session credentials, or (c) OAuth provider tokens? If (a): is 7 days too short, or do you want *unlimited sliding* while the user is active?
2. **What abuse is the per-user rate limit meant to stop?** One account attacked from many IPs (⇒ account-keyed sign-in limit)? Fairness between the two partners? Something observed? And: should userId-keyed limits **replace** the IP key or **complement** it (we recommend complement — replacement enables victim lockout)? Which endpoints should get one?
3. **Invite status `failed` — what does it mean?** Email send failed (currently spec'd as `fallback`, which must NOT invalidate the invite — FR-13), owner revoked it (⇒ name it `revoked`), or join attempt failed (⇒ event, not a status)? Our default is to drop `failed` and derive `expired` from `pending + expiresAt` (v1.0 has no cron to flip stored statuses).
4. **TTL / "N" value:** fixed default (7 d / 24 h / 30 d), Discord-style per-send choices, and max uses (single-use / unlimited-until-expiry / N)? Plus: never-expires toggle yes/no? (Goes into BRD to close B-11.)
5. **Does `inviteCode` stay** as the manual fallback alongside expiring links (our Option B recommendation — required by FR-13/US-53), or did you want it replaced (Option C — would break US-06/US-53 and needs a BRD rewrite)? Also: should **join attempts** get a rate limit? NFR-02 has none today.
6. **Timing:** decide the invite model **now**, before PEP M1's invite/join row is built (cheapest moment), or defer until after M1 ships the simple version?
7. **Doc-vs-code mismatch (needs your call):** SPEC-d1-migration B7 and ITA §7 say auth limits are "enforced at the Cloudflare edge"; the code is an in-process per-isolate `Map` and the repo configures no WAF rule. Fix the docs to match the code, configure real edge rules, or leave as-is?

---

## 7. Risks and gotchas

- **Multi-isolate state.** Anything in an isolate's memory (today's limiter, any future cache) is per-isolate and resettable — never present it as a fleet-wide guarantee without a shared store.
- **D1 write volume from counters.** A counter table makes the auth path (attacker-influenced) touch D1; bounded by the limit itself but worth an explicit budget against D1 Free (100k writes/day) before committing.
- **Token-as-credential hygiene.** Invite tokens and the pocket code are credentials: never logged, never echoed in errors (ITA §11.9, ITA §5, BRD FR-13/NFR-02); Zod at every boundary; rate-limit join attempts if added.
- **No check-then-act, no interactive transactions.** Consumption decisions must be single conditional statements or constraints (AGENTS §2/§3); the two writes of a join go in one `db.batch()` — and the batch-ordering question (claim-then-insert vs insert-gated-by-constraint) is deliberately left to the spec, not decided here.
- **Stored statuses rot without a cron.** Derive `expired`; do not store it.
- **Scope creep guard.** Workspace-partner invites are in scope (BRD §3); digital wedding invitations / RSVP / guest lists are explicitly out (BRD §3, AGENTS §10) — nothing here touches them.
- **Auth-surface widening.** Mounting Better Auth's full handler (Option B1) exposes every endpoint it ships; that is a security-review decision, not a wiring detail.
- **Cookie-refresh mechanics.** Server components cannot set cookies during render — any sliding-session work must live in a route handler or client call.

---

## 8. Recommended next steps (not decisions)

1. **Answer open questions 1–3** (meaning of "refresh token", the abuse model for per-user limits, the meaning of `failed`). These three unblock everything else.
2. **If invite tokens are wanted:** draft the BRD edits first — FR-13's "no separate invite record" sentence, TTL/max-use value (close B-11), optional join limit in NFR-02 — then an ITA §5 addendum for `invite_tokens`, answering ERD §7.1 (share tokens) in the same pass. Only then a spec/tasks.
3. **Session lifetime:** pick a value (question 1a) → one-line config; decide whether sliding (B1 vs B2) is worth a follow-up spike.
4. **Rate limits:** settle the abuse model (question 2) → then choose store (D1 table vs edge binding vs accepted caveat); if any key or number changes, patch NFR-02 and reconcile SPEC B7/ITA §7 with reality (question 7).
5. **Timing check:** invite-model decisions should land before PEP M1's "Workspace create + pocket code + invite email + join" task is picked up.
