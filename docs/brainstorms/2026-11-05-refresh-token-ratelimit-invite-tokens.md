# Brainstorm — Refresh tokens, per-user rate limits, invite tokens, guest sessions

**Date:** 2026-11-05 · **Status:** exploration — one decision recorded (rate-limit storage → new D1 table), one new idea under evaluation (guest session). No schema, migration, or BRD/ITA/ERD edits made.
**Trigger:** three informal ideas ("refresh token", "rate limit by user id — do we need a new db??", "Discord-style invite token table"), then a follow-up: "guest session to avoid DDOS … we need a table for it … for rate limit yeah we need new table and new migration file".
**Sources checked:** root `AGENTS.md`, BRD/ITA/ERD/USER-STORIES/PEP/SPEC-d1-migration, `apps/frontend/src/lib/auth/*`, `src/app/api/**`, `src/lib/db/schema.ts`, Better Auth 1.7.15 sources in `node_modules/better-auth/dist`.

---

## 0. TL;DR — "Do we need a new db?"

**Decision recorded (2026-11-05):** rate-limit counter storage → **new D1 table + migration file**. The migration is written at implementation time, not in this brainstorm. Everything else below stays open.

| Idea | New datastore? | Short answer |
|---|---|---|
| 1. Refresh token | **No** | The `session` table already exists and Better Auth already slides it. What is missing is configuration + a cookie-refresh path, not storage. |
| 2. Rate limit by user id | **DECIDED: one new table inside D1** (`rate_limits`) | Not a new *db* — same database, one table + one migration. Keys and numbers are still open (BRD NFR-02). |
| 3. Invite token table | **No new db** — one new D1 table (or one column on `workspaces`) | The blocker is **BRD scope** (FR-13's "no separate invite record"), not storage. |
| 4. Guest session (new idea) | **0 or 1 new D1 table** | The counting lives in the decided `rate_limits` table; the guest id itself can be a stateless signed cookie (0 tables) or a `guest_sessions` row (1 table, buys revocation/audit). And to be clear up front: **this is abuse control, not DDoS protection** — see §4.2. |

**Combined totals if all three proceed:** 2–3 new tables (`rate_limits` decided; `invite_tokens` pending BRD; `guest_sessions` optional) and **1–3 migration files** — tables built in the same change share one `drizzle-kit generate` migration.

Two facts that reframe all four ideas:

- **The invite/join flow does not exist yet.** `src/app/api` contains only `/api/auth` and `/api/health`; PEP M1's "Workspace create + pocket code + invite email + join" row is unchecked. The invite-token decision happens **before** the code is written — the cheapest possible moment (no migration, no data, no tests to rewrite).
- **SPEC-d1-migration B7 says auth limits are "enforced at the Cloudflare edge" — the code enforces them in an in-process `Map`** (`rate-limit.ts`, with a `shortcut:` comment admitting the per-isolate caveat). Per AGENTS ("if code and docs disagree, stop and ask") this is flagged below as open question #11, not silently resolved.

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

**DECIDED (2026-11-05): new D1 table + migration file.** User: "for rate limit yeah we need new table and new migration file for it". The comparison below is kept as the reasoning trail; migration/schema work happens at implementation, not here.

### 2.1 Current state

- `src/lib/auth/rate-limit.ts`: **in-memory `Map<string, number[]>`**, fixed 60 s window, 10 attempts, keyed by IP (`cf-connecting-ip` via `clientKey()`), capped at 10 000 keys. The file's own `shortcut:` comment states the truth: *the limit is 10/min/IP **per isolate*** — N isolates ⇒ N × the limit, and state resets on isolate recycle (fail-open).
- Used only by `POST /api/auth` (`route.ts:72`).
- Spec'd limits (BRD NFR-02): auth **10/min/IP** · import **20/hour/workspace** · invite email **10/hour/workspace**. Import and invite limits are **not implemented yet** (no import/invite routes exist) and are already keyed by **workspace**, not IP.
- **Better Auth's built-in rate limiter is inactive in this app.** It runs only inside the HTTP router (`dist/api/index.mjs:173`), and this app never mounts `auth.handler` — it calls `auth.api.*` directly, which bypasses it (`dispatch.mjs` contains no rate-limit call). Even if enabled, it keys by `IP + path` only, storage defaults to memory (or `database` via a `rateLimit` model, or `secondary-storage`), with a built-in rule of 3 attempts/10 s on sign-in paths (`dist/api/rate-limiter/index.mjs:305-318`). It cannot key by user id either.
- SPEC-d1-migration B7 / ITA §7 claim these limits are "enforced at the Cloudflare edge" — **the repo configures no WAF rate-limit rule** (nothing in `wrangler.jsonc`; WAF config lives outside the repo and could not be verified from here). See open question #11.

### 2.2 What would userId-keyed limiting actually add?

Enumerate the endpoints honestly:

| Endpoint | Identity available at the limit check | Current/spec'd key |
|---|---|---|
| `POST /api/auth` (sign-in/up) | **No userId yet** — pre-auth. Could key by *email*, but that lets an attacker lock a victim's account (DoS by burning their attempts) | IP (NFR-02) |
| Import | session → userId → workspace | workspace (NFR-02) |
| Invite send | session → workspace | workspace (NFR-02) |
| Join by pocket code (not built) | session → userId; the *code* is what is being guessed | **not in NFR-02 at all** |

Real value of a userId key: **it survives IP churn and shared IPs** (mobile CGNAT, botnets rotating IPs against one account — IP keys miss this), and it is spoof-proof. For the spec'd limits specifically, the heavy authenticated actions are *already* keyed by workspace, and with the two-member cap a workspace ≈ a couple ≈ the user unit — so a userId key adds little there. The genuine gap is **pre-auth sign-in brute-force of one account across many IPs** (email/account-keyed, complementary to the IP key — not a replacement, because account-keying alone enables victim lockout) and **join attempts** (currently unspecified entirely). A **guest id** (§4) becomes the third pre-auth key alongside IP and, later, userId.

### 2.3 Store options (evaluated against AGENTS §1/§10)

| Store | Verdict |
|---|---|
| **New D1 table** (e.g. `rate_limits(key, windowStart, count)`) | ✅ **DECIDED.** Same database — **not a new db**. Fleet-wide, any key (IP/guest/userId/workspace). |
| **In-memory (status quo)** | ❌ Not chosen — but kept as the documented fallback (`shortcut:` comment): per-isolate multiplier, resets on recycle. |
| **Cloudflare Workers rate-limit binding** (`[[ratelimit]]`) | ❌ Not chosen for app-level keys; still relevant as the *edge first line* — see §4.2 and open question #11. |
| **Cloudflare WAF rate-limit rules** (what B7 seems to describe) | ❌ Not chosen as the store (cannot key on userId); relevant as the volumetric first line — §4.2, Q11. |
| **KV** | ❌ **Banned** — AGENTS §10: no KV/R2/server-side session cache in v1.0. Never the answer here. |

### 2.4 What the decided table implies (raw material for the spec)

- **Schema sketch (not written yet):** `rate_limits(key TEXT PRIMARY KEY, windowExpiresAt/app-side timestamp, count INTEGER)`. `key` is a prefixed string — `ip:…`, `guest:…`, `user:…`, `ws:…` — so **one table serves every key type**; no per-type tables.
- **Write pattern:** single-statement upsert `INSERT … ON CONFLICT DO UPDATE SET count = count + 1` with app-side timestamps (P6: no SQL `now()`), atomic per statement — no interactive transaction needed (AGENTS §2). Denied attempts should *read and deny without incrementing*, which bounds attacker-driven writes.
- **Pruning:** no cron in v1.0 — cheapest sound mechanism is piggybacking `DELETE … WHERE windowExpiresAt < ?` (app-side timestamp) on allowed writes, every Nth request or probabilistically; rows are tiny.
- **P1–P8 fit:** table lives only in `schema.ts` (P2), access via Drizzle only (P1), no new driver import (P3), no dialect functions in queries (P6).
- **Write volume:** every auth attempt = ≥1 read, +1 write when allowed. Reads are attacker-influenced — budget against D1 Free (5M reads / 100k writes per day) before enabling; an edge first line (Q11) reduces what ever reaches D1.
- **Still open — policy, not storage:** which endpoints get which keys (IP / guestId / userId / workspace) and the actual numbers live in **BRD NFR-02**; changing them is a BRD edit (Q2). Storage was decided; the policy was not.
- **Migration file:** produced later by `drizzle-kit generate` with the implementation PR — deliberately not created by this brainstorm.

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
| `used` | ✅ Consumed once. **Enforce one-time use in the DB**, not handler logic (AGENTS §3): candidates are `members UNIQUE(inviteTokenId)` (the membership row *is* the consumption; a second use fails on the index) or a conditional claim `UPDATE … SET usedAt WHERE token = ? AND expiresAt > ? AND usedAt IS NULL` whose row-count check is the atomic decision. Both writes (claim + membership insert) go in **one `db.batch()`** (AGENTS §2) — note the open ordering question in §7. |
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

## 4. New idea — "guest session" with expiration ("to avoid DDOS")

### 4.1 What a guest session is here (and what it is not)

A **guest session** = an anonymous per-client identity: a CSPRNG id in an `httpOnly` cookie, minted before any login, stored (or signed) with an `expiresAt`. Its one real job in this product: give **unauthenticated endpoints a stable rate-limit key** that is neither the IP (shared/NAT'd, and counted per-isolate today) nor a userId (does not exist pre-auth, §2.2). It becomes the **third key** in the combined model (§4.6).

**Product-guest reading — probably out of scope.** A "browse before signing up" experience does not exist in BRD v1.0: §3 in-scope starts "Account creation and sign-in", and FR-01 gates every protected page on a session. If the user wants *that*, it is a BRD scope change (Q7). As understood here: **anti-abuse identity only** — the cookie never grants access to anything.

### 4.2 DDoS reality check (honest)

**A D1 table cannot mitigate volumetric DDoS, and this idea should not be sold as that.**

- ❌ **What it does not do:** DDoS is traffic *volume* meant to exhaust bandwidth/CPU. By the time a request reaches our Worker code, the cost is already spent — a counter row does not give it back, and worse, an app-level counter gives the attacker a lever to burn **our** D1 quota (Free tier: 5M reads / 100k writes per day) — every probe becomes a paid read on our bill.
- ✅ **What it does do:** stop *scripted abuse of specific endpoints* — credential stuffing, invite spam, pocket-code guessing — with a durable key across isolates, escalating limits (guest → authenticated), and better coverage than IP alone behind CGNAT. That is **abuse control**, and it is worth doing.
- 🎯 **The real DDoS answer is the edge** — which this app already sits behind: Cloudflare absorbs volumetric traffic, and WAF rate-limiting / bot rules kill scripted floods *before* they reach the Worker. That config lives outside this repo. A free-tier WAF rate-limiting rule is the cheaper first line and would make SPEC B7 / ITA §7's "enforced at the Cloudflare edge" claim finally true — this ties directly into open question #11. Recommended split: **edge absorbs volume, app table counts intent.**

### 4.3 Options

**Option A — Separate `guest_sessions` D1 table** (`id PK, createdAt, expiresAt, ipHash?`).
- ✅ Revocable (kill one id server-side), auditable row, survives isolate restarts, natural fit with the decided `rate_limits` table (key = guest id).
- ❌ +1 table +1 migration; rows accumulate and need deletion (no cron in v1.0); adds a privacy footprint (§4.4); and it triggers the AGENTS §10 wording question (§4.5). **Cleanup mechanism (cheapest sound):** expiry is *derived at read* (`expiresAt < now` ⇒ reject, no status flip), and old rows are deleted lazily — piggyback `DELETE … WHERE expiresAt < ?` (app-side timestamp) on the mint path, every Nth mint or probabilistically; rows are tiny and TTL is short, so growth stays bounded. No cron, no background job (AGENTS §10 excludes neither, but v1.0 has no job infra and building one for row cleanup is absurd).

**Option B — Stateless signed cookie (HMAC) — no table at all.**
Mint `guestId + issuedAt`, sign with a key derived from the existing `BETTER_AUTH_SECRET`; expiry enforced by verifying `issuedAt` age at every check — the TTL lives *in the signature*, so expiry is automatic and tamper-proof.
- ✅ **Zero tables, zero migrations, zero D1 traffic for identity**; natural expiry; no cleanup problem; no §10 wording question (nothing stored); cannot be forged without the secret.
- ❌ **No revocation** (cannot kill one guest id), no server-side audit row, and rate-limit *counting* still needs the decided `rate_limits` table anyway — the guest id is just the key that goes in it.
- Honest read: **the table you are picturing for guests is mostly the rate-limit table you already decided on.** The guest *id* can be a cookie; the *counters* are the table. A `guest_sessions` row buys exactly two things over a signed cookie: revocation and audit.

**Option C — Reuse Better Auth's `session` table with nullable `userId`.**
- ❌ **Dismissed cleanly:** `session.userId` is `NOT NULL` + FK to `user` (`schema.ts`); the table is CLI-generated and ITA §11.6 says regenerate-and-diff, never hand-edit — injecting guest rows drifts it; Better Auth manages this table's lifecycle and semantics (a row means *authenticated*, `requireSession()` reads it — ADR-11). A "half-session" blurs the authorization boundary for zero gain. Not viable.

### 4.4 Security and gotchas

- **Reset attack — the key weakness.** An attacker clears the cookie → fresh guest id → fresh limits. **A guest key alone is not a defense**: pair every guest-keyed bucket with the IP bucket (both must pass) on sensitive endpoints, so rotating ids does not multiply the budget.
- **Never an auth boundary.** The guest cookie feeds rate limits *only* — never access decisions (ADR-11, AGENTS §9: hidden UI is not security). Joining still requires a real session (FR-01/FR-02); the two-member cap and `UNIQUE(userId)` are untouched by anything in this section.
- **Cookie attributes:** `httpOnly`, `Secure` in prod, `SameSite=Lax`, carries an id only — same rules as the session cookie (AGENTS §9).
- **CSPRNG id**, ≥128 bits (`crypto.randomUUID()`), generated app-side (P6).
- **It is a credential-adjacent identifier:** never logged, never echoed in errors — same hygiene as the pocket code (ITA §11.9, ITA §5). No `console.log(guestId)`.
- **Zod at the boundary; one mint/verify implementation** (DRY §7) — no ad-hoc signing in handlers.
- **Privacy:** a stored visitor identifier (especially an `ipHash` column) is personal data under **UU PDP** (BRD glossary; **NFR-06**: delete on request, purge ≤ 30 days). Short TTL helps — expired rows self-eliminate on the lazy delete — but the NFR-06 deletion flow must be able to cover these rows, and the Phase-4 privacy policy should mention them. Not a BRD edit by itself; flag for whoever writes the policy.

### 4.5 AGENTS §10 reading — stop-and-ask (open question #9)

AGENTS §10 bans "KV/R2/**server-side session cache**". Is a D1 `guest_sessions` table that?

- **My reading: no.** A *cache* is a duplicate/faster copy of data that lives elsewhere — the ban targets adding a second storage tier (KV/R2) for performance. Sessions already live in D1 (the `session` table is itself server-side state and is obviously sanctioned); an authoritative anti-abuse row in the **one sanctioned datastore** is not a cache, and a guest row is not a session in the auth sense.
- **But** the phrase sits one word away from "guest session", and AGENTS says *if a task requires one of these, stop and raise it*. So this goes to the user as an explicit question rather than being waved through. **If Option B (signed cookie) is chosen, the question evaporates** — nothing is stored.

### 4.6 Combined model — keys, tables, migrations

Rate-limit keys after all ideas land (one `rate_limits` table, prefixed keys):

| Key prefix | Endpoints | Source | Exists today? |
|---|---|---|---|
| `ip:` | auth attempts (NFR-02), join | `clientKey()` (`cf-connecting-ip`) | yes (in-memory; moves to the table) |
| `guest:` | auth attempts, join — pre-auth stable identity | guest cookie (§4.3) | new (optional, Q8) |
| `user:` | authenticated per-account limits | session | new (Q2) |
| `ws:` | import, invite send (NFR-02) | membership | not built yet |

Enforcement rule for pre-auth endpoints: **IP bucket AND guest bucket must both pass** (reset-attack defense, §4.4). Escalation: guest limits are the *floor*; an authenticated request is counted under `user:`/`ws:` instead.

**Table / migration count across everything:**

| Table | Status | Migration |
|---|---|---|
| `rate_limits` | ✅ **DECIDED** | 1 (with the implementation PR) |
| `invite_tokens` | recommended, BRD-blocked (§3) | +1 when FR-13/B-11 edits land |
| `guest_sessions` | optional (Q8) — 0 tables if signed cookie | +0 or +1 |
| **Total** | **1 decided, up to 3** | **1–3 migration files** — tables built in one change share one `drizzle-kit generate` migration, so batching `rate_limits` + `guest_sessions` keeps it at 1 |

### 4.7 Recommendation (hypothesis)

1. **Reframe the goal:** build this as **abuse control**, not DDoS protection (§4.2). The actual volumetric answer is the Cloudflare edge — check what a free-tier WAF rate-limit rule buys before writing any guest code (Q11), and note it would finally make SPEC B7 true.
2. **Storage lean: signed cookie (Option B) + the decided `rate_limits` table.** You get the stable pre-auth key with zero extra tables; move to Option A (`guest_sessions`) only if you want server-side revocation or an audit trail — that is the entire difference.
3. **TTL:** anti-abuse identities want short — 30 m–24 h — because long-lived identifiers are privacy surface and resettable anyway (Q10). A product-guest reading (Q7) would want days and is a BRD change first.
4. **If a table is built:** §4.5's §10 reading must be confirmed by the user first (Q9), and the lazy-delete cleanup + no-logging rules above are non-negotiable.

---

## 5. Scope classification (a) config of what exists · (b) normal v1.0 feature work · (c) BRD/doc changes

| # | Item | Class |
|---|---|---|
| 1a | `session.expiresIn` / `updateAge` in `auth.ts` | **(a) config** |
| 1b | Cookie-refresh path (GET `/api/auth` relay or mounted `auth.handler` + client call) | **(b) feature work** (B1/B2 is an architecture choice) |
| 1c | Session duration as a user-visible promise | **(c)** BRD FR-01 line (optional but recommended) |
| 1d | Rotating tokens / OAuth refresh tokens | out of v1.0 (no requirement; OAuth = BRD §3 scope change) |
| 2a | **DECIDED: D1 `rate_limits` table + migration** | **(b) feature work**; migration at implementation |
| 2b | Which keys per endpoint + limit numbers (IP/guest/user/ws) | **(c)** BRD **NFR-02** edit (values live there) — Q2 |
| 2c | SPEC B7 / ITA §7 "enforced at the Cloudflare edge" vs in-memory code | **(c)** doc-vs-code reconciliation — Q11 |
| 3a | Option A: `inviteCodeExpiresAt` column | (b) after a small **(c)**: BRD TTL value (B-11) |
| 3b | Option B: `invite_tokens` table + routes | **(c) first**: BRD **FR-13** ("no separate invite record" sentence), **FR-02** wording if link semantics added, TTL/max-use value (**B-11**), optional join rate limit (**NFR-02**); then ITA §5 addendum + ERD sync; then (b) |
| 3c | Option C: replace `inviteCode` | (c) — **BRD rewrite; flagged, not recommended** |
| 4a | Guest id as stateless signed cookie | **(b)** small feature work; no table, no BRD edit |
| 4b | `guest_sessions` D1 table (+1 migration) | **(b)** feature work + **stop-and-ask** AGENTS §10 reading first (Q9) |
| 4c | Guest motivation: anti-abuse vs product "browse before signup" | anti-abuse = (b); product-guest = **(c)** BRD scope change (Q7) |
| 4d | Guest TTL value | internal spec value if anti-abuse (Q10); BRD if product-guest |
| 4e | Stored visitor identifiers vs privacy | no BRD edit, but must fit **NFR-06** (PDP deletion) + Phase-4 privacy policy — §4.4 |
| all | New dependency, KV, R2, background/cron job for expiry | ❌ excluded (AGENTS §1/§10) — derived expiry + lazy delete avoid the cron |

---

## 6. Comparison matrix

| Criterion | 1A config | 1B sliding | 2B D1 counter ✅DECIDED | 2C edge first line | 3A TTL column | 3B token table | 4A guest table | 4B signed cookie |
|---|---|---|---|---|---|---|---|---|
| New datastore | none | none | **table in D1** | none (platform) | column | **table in D1** | **table in D1** | none |
| New BRD edit | optional (FR-01) | optional (FR-01) | keys/numbers (NFR-02) | NFR-02 wording | yes (TTL value) | **yes (FR-13 + TTL + …)** | no (if anti-abuse) | no |
| Code cost | ~1 line | endpoint + client + tests | medium (upsert, prune, tests) | config outside repo | small | largest | medium (+cleanup) | small |
| Fleet-wide correctness | n/a | n/a | ✅ | ✅ | n/a | n/a | ✅ | ✅ (stateless) |
| Main risk | hard logout at N days | auth-surface widening (B1) | D1 read/write volume on hot path | stack drift, untestable in repo | shared-credential expiry confusion | two coexisting credentials; status semantics | reset attack; §10 wording; PDP footprint | no revocation/audit |
| Fits AGENTS §1/§10 | ✅ | ✅ | ✅ | ⚠️ new primitive | ✅ | ✅ (after BRD edit) | ⚠️ §10 wording (Q9) | ✅ |

---

## 7. Open questions for you (answerable directly)

**✅ Answered (2026-11-05):** rate-limit counter storage → **new D1 table + migration file** (spec will carry the schema sketch in §2.4; no schema/migration written by this brainstorm).

Still open:

1. **"Refresh token" — which did you mean?** (a) stay logged in longer / stop the 7-day re-login, (b) rotating session credentials, or (c) OAuth provider tokens? If (a): is 7 days too short, or do you want *unlimited sliding* while the user is active?
2. **Rate-limit keys and numbers:** storage is decided — policy is not. Which endpoints get which keys (IP / guest / userId / workspace) and what limits? Should the account key *complement* the IP key (our recommendation — replacing it enables victim lockout) or replace it? Any change to NFR-02's existing keys/values is a BRD edit.
3. **Invite status `failed` — what does it mean?** Email send failed (currently spec'd as `fallback`, which must NOT invalidate the invite — FR-13), owner revoked it (⇒ name it `revoked`), or join attempt failed (⇒ event, not a status)? Our default: drop `failed`, derive `expired` from `pending + expiresAt`.
4. **Invite TTL / "N" value:** fixed default (7 d / 24 h / 30 d), Discord-style per-send choices, and max uses (single-use / unlimited-until-expiry / N)? Never-expires toggle? (Goes into BRD to close B-11.)
5. **Does `inviteCode` stay** as the manual fallback alongside expiring links (our recommendation — required by FR-13/US-53), or replaced (breaks US-06/US-53, needs a BRD rewrite)? Also: should **join attempts** get a rate limit? NFR-02 has none today.
6. **Invite timing:** decide the model **now**, before PEP M1's invite/join row is built (cheapest moment), or defer?
7. **Guest idea — what is it for?** Anti-abuse identity only (our default; fits v1.0 as-is) or a product "browse before sign-up" experience? The latter gates nothing today — BRD §3 starts at "Account creation and sign-in", FR-01 requires a session — so it is a BRD scope change first.
8. **Guest identity storage:** stateless HMAC-signed cookie (0 tables, expiry inside the signature, **no revocation**) vs D1 `guest_sessions` table (+1 table/migration, revocable + audit, needs lazy cleanup)? Counting is in `rate_limits` either way — the table buys only revocation + audit.
9. **AGENTS §10 reading (stop-and-ask):** is a D1 `guest_sessions` row a banned "server-side session cache"? Our reading: no — authoritative anti-abuse state in the sanctioned datastore, not a performance cache (§4.5). Confirm before building; the question vanishes if you pick Q8's cookie.
10. **Guest TTL:** 30 m–24 h for an anti-abuse identity (privacy surface + resettable anyway) vs days–weeks if product-guest (Q7)?
11. **Edge vs app (was #7):** SPEC B7 and ITA §7 claim edge rate limits the code does not have — fix the docs to match the code, configure a real free-tier WAF rate-limit rule as the first line (also the actual volumetric/DDoS answer, §4.2), or both?

---

## 8. Risks and gotchas

- **Guest-id reset attack.** Clearing the cookie mints a fresh identity — a guest key alone never defends an endpoint; always pair it with the IP bucket (§4.4).
- **Guest is not an auth boundary.** The guest cookie feeds rate limits only, never access decisions (ADR-11); join/sign-in still require a real session (FR-01/FR-02); the two-member cap is untouched.
- **Privacy footprint of visitor identifiers.** Stored guest ids (especially an `ipHash`) are personal data under UU PDP — short TTL helps, but NFR-06's delete-on-request flow must cover these rows (§4.4).
- **Multi-isolate state.** Anything in an isolate's memory (today's limiter, any future cache) is per-isolate and resettable — never present it as a fleet-wide guarantee without a shared store.
- **D1 write volume from counters.** The decided table puts the auth path (attacker-influenced) on D1 — budget against D1 Free (5M reads / 100k writes per day); denied attempts should not write (§2.4); an edge first line (Q11) keeps probes away from D1 entirely.
- **Token-as-credential hygiene.** Invite tokens, the pocket code, and the guest id are credentials: never logged, never echoed in errors (ITA §11.9, ITA §5, BRD FR-13/NFR-02); Zod at every boundary; rate-limit join attempts if added.
- **No check-then-act, no interactive transactions.** Consumption decisions must be single conditional statements or constraints (AGENTS §2/§3); the two writes of a join go in one `db.batch()` — the batch-ordering question (claim-then-insert vs insert-gated-by-constraint) is deliberately left to the spec, not decided here.
- **Stored statuses rot without a cron.** Derive `expired` (invites) and guest expiry; do not store flipped statuses; delete old rows lazily.
- **Scope creep guard.** Workspace-partner invites are in scope (BRD §3); digital wedding invitations / RSVP / guest lists are explicitly out (BRD §3, AGENTS §10) — "guest session" here is an anonymous anti-abuse id, nothing to do with wedding guests.
- **Auth-surface widening.** Mounting Better Auth's full handler (Option B1) exposes every endpoint it ships; that is a security-review decision, not a wiring detail.
- **Cookie-refresh mechanics.** Server components cannot set cookies during render — any sliding-session or guest-mint work must live in a route handler or client call.

---

## 9. Recommended next steps (not decisions)

1. **Answer Q7–Q11** (guest motivation, storage, §10 reading, TTL, edge split) — these unblock the guest idea; Q11 in particular should be settled *before* any guest code, because a free-tier edge rule may be the cheaper first line.
2. **Answer Q1–Q6** (session meaning, rate-limit keys/numbers, invite semantics/TTL/timing) — these unblock ideas 1 and 3.
3. **Invite:** draft the BRD edits first — FR-13's "no separate invite record" sentence, TTL/max-use value (close B-11), optional join limit in NFR-02 — then an ITA §5 addendum for `invite_tokens`, answering ERD §7.1 (share tokens) in the same pass. Only then a spec/tasks.
4. **Rate limits:** storage decided → the spec can draft now from §2.4; settle keys/numbers (Q2) and reconcile SPEC B7/ITA §7 with reality (Q11) in the same pass; the `rate_limits` migration rides with the implementation PR.
5. **Session lifetime:** pick a value (Q1) → one-line config; decide whether sliding (B1 vs B2) merits a follow-up spike.
6. **Timing check:** invite-model decisions should land before PEP M1's "Workspace create + pocket code + invite email + join" task is picked up.
