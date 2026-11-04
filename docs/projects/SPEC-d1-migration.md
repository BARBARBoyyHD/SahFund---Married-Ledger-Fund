# Specification: Database Migration — Neon Postgres → Cloudflare D1

**Status:** Draft for review · **Date:** 2026-11-04 · **Change type:** Technical (requires ITA ADR first — `PEP §10`)
**Sources of truth:** `ITA §N` · `BRD §N` · `PEP §N` · `AGENTS.md §N` (this document is a change spec, not a source of truth)
**Decision owner:** User — *migrate to D1 now; preserve later portability through Drizzle conventions only (no abstraction layer).*

---

## 1. Overview

### 1.1 Problem & motivation

SahFund's documented stack (`AGENTS.md §1`, `ITA §3`) pins Neon Postgres accessed through the `neon-http` driver. The user has decided to move the database to **Cloudflare D1** (managed SQLite on the same platform as the Worker) while keeping the project movable to any SQL database when it scales.

Motivation:

- **Cost at current scale:** D1 free tier (5M reads/day, 100k writes/day, 5GB) dwarfs the workload (~5k writes/month ≈ 170/day). No database bill, no connection-pool story, no cross-vendor latency between Worker and DB.
- **Platform unity:** the app already targets Cloudflare Workers (`ITA ADR-01`); D1 removes the second vendor (Neon) and its `DATABASE_URL` secret, branch workflow, and region pinning.
- **Portability is cheap now, expensive later:** there are **zero users and no schema yet** (see §2). Choosing D1-first with strict Drizzle conventions costs nothing today; retrofitting portability after a Postgres schema exists would cost migrations.

### 1.2 Goals

- G1: All durable state served by D1 via `drizzle-orm/d1`; `@neondatabase/serverless` and every Neon artifact removed from code, config, env, and docs.
- G2: Portability achieved by **discipline, not layers**: query-builder-only access, dialect types confined to one file, one client module as the single swap point — written as checkable rules (§3.2).
- G3: Existing behaviour preserved exactly: 503-on-DB-down (`ITA §2`, `BRD NFR-07`), one atomic `db.batch()` per multi-table write (`AGENTS §2`), workspace-scoped queries, no row contents in logs.
- G4: Every doc that names Neon/Postgres-as-store updated exhaustively (§5), with the D1 exclusion lifted from all four places it appears.
- G5: Integration testing replaced without Neon branches: local D1 (Miniflare) in `node:test`, Workers-preview runtime for Playwright (`PEP §7`).

### 1.3 Non-goals (out of scope — §14)

No data migration · no repository/abstraction layer · no Turso/Hyperdrive/edge-replica design · no v1.0 feature changes · no Better Auth wiring (tracked separately, §7.5) · no domain schema authoring (arrives with PEP M1/M2; this change delivers the pipeline).

### 1.4 Success metrics

| # | Metric | Verification |
|---|---|---|
| M1 | `/api/health` → `200 {db:"up"}` with D1 in dev and preview; `503 {db:"down"}` when binding missing/unreachable | Playwright `requirements.spec.ts` green (T6) |
| M2 | Grep gates pass: `@neondatabase`, `neon-http`, `DATABASE_URL` = 0 hits outside an allowlist (§5.4) | CI lint job (T7) |
| M3 | Portability rules enforced by lint, not just review (P1–P8, §3.2) | CI lint job deliberately fails on a seeded violation (T5) |
| M4 | `typecheck + unit + schema-drift + integration` green in CI | Workflow file exists and passes (T7) |
| M5 | Future swap documented as ≤ 3 steps (schema dialect import, client import, regenerate migrations) | AGENTS §1 edit (T8) |

---

## 2. Current-state findings (repository inspection — read before estimating)

The repository is **materially earlier-stage than the migration brief assumed**. These findings reshape the work; each is verified by direct file read or grep.

| # | Finding | Evidence | Consequence for this spec |
|---|---|---|---|
| F1 | **No `src/lib/db/schema.ts` exists.** The only `schema.ts` is `src/lib/auth/schema.ts` — a Zod *form* schema. | `glob **/schema.ts`; `ERD.md` line 8 ("pre-schema … no Drizzle schema code anywhere") | Schema portability analysis (§6) is done against the **planned** types in `ERD.md`/`ITA §5`, not against code. There is no Postgres schema to convert. |
| F2 | **Drizzle is not installed.** No `drizzle-orm`, `drizzle-kit` in `package.json` or `package-lock.json`. No `drizzle.config.*` anywhere. | grep `drizzle` in `*.json` → 0; glob `drizzle*` → 0 | "Dialect switch" is really **first-time setup**: install Drizzle with `dialect: "sqlite"` from day one (§8). |
| F3 | **The only DB code is the lazy client + probe.** `src/lib/db/index.ts` exports `getSql()` (neon-http singleton, throws if `DATABASE_URL` unset) and `probeDb()` (`select 1` with a 3s `AbortSignal`). Sole consumer: `src/app/api/health/route.ts`. | file read; grep `getSql\|probeDb\|DATABASE_URL` → 3 files | The driver swap touches **one module + one route** (unchanged). No mutation code exists — `db.batch()` call sites: **zero**. |
| F4 | **No raw SQL anywhere except the probe.** No `.execute(`, no `sql\`` templates, no `SELECT/INSERT/UPDATE` in `src/`. | grep across `apps/frontend/src` → 1 match (`"select 1"`) | The raw-SQL inventory is one allowlisted line; the "no raw SQL" rule (P1) starts from a clean slate. |
| F5 | **`src/core/*` is I/O-free as promised.** No `fetch`, `process.env`, `Date.now`, or upward imports in `money.ts`, `forecast.ts`, `core.test.ts`. | grep in `src/core` → 0 matches | G4/portability rule P4 is a *preservation* check, not new work. |
| F6 | **No `wrangler.toml`/`wrangler.jsonc`, no `@opennextjs/cloudflare`, no `wrangler` dep.** The Cloudflare deploy target (ITA ADR-01, PEP M1) is not yet wired. | glob `wrangler.*` → 0; `package.json` deps read | **Hard dependency:** D1 only exists as a Workers binding. The driver swap *requires* bootstrapping the OpenNext/wrangler binding layer (T2), which overlaps PEP M1's "OpenNext deploy" task. |
| F7 | **No CI workflow exists.** No `.github/`. | glob `.github/**` → 0 | "CI implications" (§8.4) = *define and create* the gates; this overlaps PEP M1's CI task. |
| F8 | **Better Auth is not installed; auth is a 503 stub.** `src/app/api/auth/route.ts` validates Zod then returns 503 with a `shortcut:` comment ("Better Auth is not installed yet (US-01)"). No auth tables, no session code, no `better-auth` dep. | file read; grep `better-auth` → 0 | Auth DB work is **out of scope**; §7.5 records the future wiring requirements so the D1 choice does not paint auth into a corner. |
| F9 | **Raw SQL / hashing:** no `dedupe_hash` implementation exists yet (no import route). `AGENTS §3` specifies `sha256(...)`; D1/SQLite has **no `sha256()`**. | grep `dedupe\|sha256` → only a comment in the auth route | Convention P6: hashing must be app-side in one pure function (§6.4). |
| F10 | **Neon platform artifacts present:** `neon.ts` (Neon platform config), `.neon/` project link, `@neon/config` + `@neon/env` deps, `.env.example` with `DATABASE_URL*`, `NEON_AUTH_*`, `AWS_*`, `NEON_REALTIME_*`. | file reads | Cleanup task T4; `.env.example` rewrite (§5.3). |
| F11 | **E2E runs the app in plain Node.** `playwright.config.ts` webServer = `npm run build && npm run start` — no Workers runtime, therefore **no D1 binding**, yet the suite asserts `/api/health` → `200 {db:"up"}`. | file read; `e2e/requirements.spec.ts` line 40–46 | E2E must switch to a Workers-preview runtime (T6) or the health assertion fails by construction. |
| F12 | **`BRD §3` does *not* exclude D1.** The out-of-scope list (BRD lines 45–57) contains no KV/R2/D1 entry. The exclusion lives in `AGENTS §10`, `USER-STORIES.md:35`, `ERD.md:433`, `ITA.md:49`. | grep `D1\|KV\|R2` in BRD → only NFR-05 and the diagram | Corrects the brief: BRD needs edits only at **NFR-05 (line 225)** and the **diagram (line 253)** — §5.2. |

---

## 3. Functional specification

### 3.1 Behaviour preservation (must not change)

| ID | Behaviour | Source | How preserved under D1 |
|---|---|---|---|
| B1 | DB unreachable / binding missing → **explicit 503** with retry message; never blank, never zeroed totals | `ITA §2`, `BRD NFR-07`, `AGENTS §8` | `probeDb()`/`getDb()` throw at request time (lazy singleton, same shape as today's `DATABASE_URL` check); `api/health/route.ts` catch-all already maps any throw → 503. **Route unchanged.** |
| B2 | Health probe bounded (a hung DB cannot hang the probe) | `db/index.ts` comment; `ITA §6` | D1 binding calls accept no `AbortSignal`; bound with `Promise.race` + `AbortSignal.timeout(3000)` as timer (the underlying call continues; the probe returns 503). Comment the shortcut. |
| B3 | Multi-table write = **one atomic batch**; `db.transaction()` forbidden | `AGENTS §2`, `ITA ADR-02` | Rule text survives verbatim; only the citation changes. `drizzle-orm/d1` exposes `.batch()` identically; D1's `batch()` is documented as a transaction that "aborts or rolls back the entire sequence" (Cloudflare D1 docs, `d1-database`, rev. 2026-01-19). No call sites exist today (F3); the rule binds future import code. |
| B4 | Every query workspace-scoped; membership verified in handler | `AGENTS §4`, `ITA §7` | Dialect-independent Drizzle logic; no change. |
| B5 | Money = 64-bit integer minor units; floats banned | `ITA §5`, `ADR-07`, `BRD NFR-03` | SQLite `INTEGER` is always 64-bit; Drizzle `integer({ mode: 'bigint' })` (§6.3). Never `real`. |
| B6 | No row contents/amounts in logs | `AGENTS §11.9`, `ITA §11` | No logging added; health error stays generic. |
| B7 | Edge rate limits (auth 10/min/IP, import 20/hour/workspace) | `AGENTS §9`, `BRD NFR-02` | Unaffected — enforced at the Cloudflare edge, independent of the datastore. D1 adds *daily quota* ceilings (§11 R7), not per-request limits. |
| B8 | **Uniqueness invariants enforced in the DB, not the handler:** re-import dedupe, one invite per code, one category name per workspace, **one workspace per user** (`members UNIQUE (userId)` + `workspaces UNIQUE (ownerId)` backstop), **one owner + max two members** (`members UNIQUE (workspaceId, role)` + `CHECK (role IN ('owner','member'))`) | `AGENTS §3` | All five are plain UNIQUE/CHECK constraints — SQLite/D1 supports them identically (§6.1). Constraint failures surface as driver errors → `isUniqueViolation()` → the same 409-style message (BRD FR-02); handler never counts members, never string-matches SQLSTATE. |

### 3.2 Portability conventions — **checkable rules** (the core deliverable)

These rules are the *entire* portability strategy (the user rejected an abstraction layer; `AGENTS §5` forbids speculative ones). Each rule names its own enforcement so CI, not memory, keeps it true. **They are to be appended to `AGENTS.md` (T8).**

| ID | Rule | Enforcement / check |
|---|---|---|
| **P1** | **All DB access goes through Drizzle's query builder. No raw SQL** — except two allowlists: (a) schema-level constraint/default expressions (`CHECK`, `DEFAULT`) inside `schema.ts`, (b) the `select 1` fragment inside `probeDb()` in `src/lib/db/index.ts`. | ESLint `no-restricted-imports` bans `sql` (from `drizzle-orm`) outside `schema.ts` + `db/index.ts`; grep `.execute(`/`.prepare(` outside `src/lib/db/` = 0. |
| **P2** | **Dialect-specific types live only in `src/lib/db/schema.ts`.** No `drizzle-orm/sqlite-core` import anywhere else. | ESLint `no-restricted-imports`: `drizzle-orm/sqlite-core` path restricted to `schema.ts`. |
| **P3** | **`src/lib/db/index.ts` is the only module that imports the driver** (`drizzle-orm/d1`) **and the only module that classifies driver errors** (`isUniqueViolation()` — see §6.2) — the single swap point for all dialect knowledge. | ESLint restriction + grep: exactly one importing file; handler code calls `isUniqueViolation`, never matches raw error strings/SQLSTATE itself. |
| **P4** | **`src/core/*` stays pure** — no `fetch`, no `db`, no `process.env`, no implicit `Date.now`. | Grep gate in CI (0 matches, pattern in §3.2 note). |
| **P5** | **Money columns are `integer({ mode: 'bigint' })`** — never `real`, never `mode: 'number'` on `*Minor` columns. | Schema review + grep `real(` / `mode: "number"` on `*Minor` = 0. |
| **P6** | **No dialect functions in queries** — no SQL-side `sha256`, JSON-path operators, `now()`, `gen_random_uuid()`, `ILIKE`, arrays. Ids and timestamps are generated app-side (Drizzle `$defaultFn` / handler). Hashing lives in exactly one pure function (`AGENTS §7` DRY rule, extended for SQLite's missing `sha256`). | Review + grep; unit test for the hash function. |
| **P7** | **Multi-table writes: one `db.batch()`, never `db.transaction()`** (D1 has no interactive transactions — same constraint neon-http had). | Existing `AGENTS §2` rule; grep `db.transaction` = 0 (already true). |
| **P8** | **A future DB swap = 3 steps:** (1) change dialect imports in `schema.ts`, (2) change the driver import in `db/index.ts`, (3) regenerate migrations. **No other file changes.** | Documented in `AGENTS §1` (T8); provable because P1–P3 keep all dialect knowledge in those two files. |

> P4 check pattern (CI): `grep -rnE "fetch\(|process\.env|Date\.now" apps/frontend/src/core/` → must be empty.

**What P1–P8 deliberately do NOT add:** no repository interface, no `Database` port/adapter, no query-facade folder, no "just in case" wrapper. Two files carry the dialect; that is the whole design (`AGENTS §5`).

---

## 4. Non-functional requirements

| NFR | Requirement | Target / note |
|---|---|---|
| N1 | Availability behaviour on DB failure | Unchanged: `BRD NFR-07`, 99.5% monthly, explicit error (B1). D1 "overloaded" errors surface as throws → 503, correct by construction. |
| N2 | Performance | Unchanged: import ≤ 5 s p95, dashboard ≤ 1.5 s p95 (`BRD NFR-04`). D1 is same-platform as the Worker (no cross-region hop); one `batch()` = one round trip (D1 counts a batch as a single query per invocation — Cloudflare limits doc). |
| N3 | Portability (revised) | `BRD NFR-05` wording changes from "standard Postgres" to "standard SQL behind Drizzle with the dialect isolated" (§5.2). Target unchanged: migration off the host ≤ 2 engineering days — now measured as "P8's 3 steps + regenerating migrations". |
| N4 | Cost | ≤ US$20/month at 1,000 workspaces (`BRD NFR-10`) — D1 free tier covers v1.0 with ~2 orders of magnitude headroom. |
| N5 | Retention / PDP (`BRD NFR-06`) | `ON DELETE CASCADE` from `workspaces` works: **D1 enforces foreign keys by default** (equivalent to `PRAGMA foreign_keys=on` — Cloudflare D1 docs). Backup/retention differs from Neon PITR: **verify current D1 backup retention against the 30-day purge window when this ships** (T8 edit carries an explicit verify note; §11 R9). |
| N6 | Observability | `/api/health` unchanged; `wrangler tail` / Workers Logs unchanged (`ITA §8`). |

---

## 5. Doc-edit inventory — exhaustive (deliverable 2)

Exact edits. "Quote" = current text (fragment); "Replace with" = the new text. Line numbers refer to the files as read on 2026-11-04.

### 5.1 AGENTS.md (root)

| Loc | Current (quote) | Replace with |
|---|---|---|
| §1 stack table, DB row (line 21) | `\| DB \| Neon Postgres (ap-southeast-1), **\`neon-http\` driver** \| HTTP driver, no connection pool \|` | `\| DB \| Cloudflare D1 (SQLite) via \`drizzle-orm/d1\` \| Binding-based, no connection pool; single swap point \`src/lib/db/index.ts\` \|` |
| §1 stack table, Auth row | `\| Auth \| Better Auth \| sessions in our own Postgres \|` | `\| Auth \| Better Auth \| sessions in our own database (D1) \|` |
| §1 stack table, Money row | `\| Money \| \`BIGINT\` minor units (1/100 rupiah) \| **floats banned** … \|` | `\| Money \| 64-bit integer minor units (1/100 rupiah) — SQLite \`INTEGER\`, Drizzle \`mode: 'bigint'\` \| **floats banned** … \|` |
| §1, "Neon skills" block (lines 30–45: nine-skill table, freshness check, Neon docs pointer, "Known divergence" note) | entire block | Replace with: **`Cloudflare D1 — source of truth.** D1 behaviour: \`https://developers.cloudflare.com/d1/llms.txt\` (append \`.md\` to a page to fetch Markdown). Migrations: \`drizzle-kit generate\` → committed SQL → \`wrangler d1 migrations apply\`. Do not add skills or helpers that recommend a different driver or an abstraction layer — §1 is fixed and the swap point is \`src/lib/db/index.ts\` (portability rules P1–P8, §3.2 of SPEC-d1-migration).` |
| §1, portability note (new, after stack table) | — | Add: **`Portability rules (P1–P8):** all DB access through Drizzle's query builder (no raw SQL); dialect types only in \`src/lib/db/schema.ts\`; only \`src/lib/db/index.ts\` imports the driver; \`src/core\` stays pure; money is \`integer({mode:'bigint'})\`; no SQL-side hashing/JSON-path/dialect functions; one \`db.batch()\` per multi-table write. A future swap = dialect import + client import + regenerate migrations.` |
| §2 hard constraint (line 51) | `**Hard constraint (ITA §11.4, ADR-02): \`neon-http\` has no interactive transactions. \`db.transaction()\` WILL NOT WORK on this driver. Do not write it.**` | `**Hard constraint (ITA §5, ADR-13): D1 has no interactive transactions. \`db.transaction()\` WILL NOT WORK on this driver. Do not write it — \`db.batch()\` is atomic (D1 rolls the sequence back on failure).**` |
| §2 migrations line (line 58) | `- Migrations: \`drizzle-kit generate\` → committed SQL → \`drizzle-kit migrate\`. **Expand/contract only**: …` | `- Migrations: \`drizzle-kit generate\` → committed SQL → \`wrangler d1 migrations apply\` (\`--local\`/\`--remote\`). **Expand/contract only**: …` (keep the expand/contract sentence verbatim) |
| §3 dedupe note (after line ~70) | `dedupe_hash = sha256(workspaceId \| date \| …)` | Append: `(computed app-side in exactly one pure function — SQLite/D1 has no \`sha256()\`)` |
| §3 rules bullet (two-member cap / one workspace per user) | `… the handler only maps SQLSTATE 23505 to the clear 409-style message (BRD FR-02). …` | `… the handler only maps the driver's unique-constraint violation (via \`isUniqueViolation()\` in \`src/lib/db/index.ts\`; Postgres \`23505\`, SQLite \`SQLITE_CONSTRAINT_UNIQUE\`) to the clear 409-style message (BRD FR-02). …` — keeps the rule, drops the Postgres-only code from the handler contract |
| §5 tree, `src/lib/db/` line (line 111) | `src/lib/db/      schema + lazy Neon client` | `src/lib/db/      schema + lazy D1 client (single swap point)` |
| §10 exclusion (line ~213) | `… no roles beyond owner/member · no KV/R2/D1/server-side session cache.` | `… no roles beyond owner/member · no KV/R2/server-side session cache.` (**D1 lifted** — the datastore is now D1) |
| §11 integration line (line 218) | `- Integration: import → persist → report against a Neon *branch*, including a duplicate re-import.` | `- Integration: import → persist → report against a local D1 (Miniflare), including a duplicate re-import.` |
| §12 DoD | (see §13.1 — **no text change required**; this spec maps every item) | — |

### 5.2 docs/projects/ITA.md

| Line | Current (quote) | Replace with |
|---|---|---|
| 37–40 (diagram) | `│ Neon Postgres        │` / `│ ap-southeast-1       │` / `│ PITR backups         │` | `│ Cloudflare D1        │` / `│ (SQLite, binding)    │` / `│ backups: D1 plan     │` (keep box alignment) |
| 47 (request flow) | `a \`dedupe_hash\` filters rows already stored` | unchanged (hash now known app-side — covered by §3 P6) |
| 49 | `All durable state is in Postgres: users, sessions, … There is no KV, no R2, no D1, no server-side session cache.` | `All durable state is in Cloudflare D1 (SQLite): users, sessions, workspaces, members, categories, imports, transactions, commitments. There is no KV, no R2, no server-side session cache. Portability comes from discipline, not an abstraction layer: every access goes through Drizzle's query builder, dialect-specific types live only in \`src/lib/db/schema.ts\`, and \`src/lib/db/index.ts\` is the single swap point (AGENTS §1, rules P1–P8).` |
| 51 | `If Postgres is unreachable the app returns an explicit 503 …` | `If D1 is unreachable (or the binding is missing) the app returns an explicit 503 …` |
| 67 (stack row) | `\| Database \| Neon Postgres \| serverless driver 1.2.0 \| Managed Postgres with PITR; HTTP driver avoids connection exhaustion on Workers \|` | `\| Database \| Cloudflare D1 \| drizzle-orm/d1 (bundled with Drizzle) \| Managed SQLite on the Worker's platform; binding avoids connections entirely; free tier (5M reads/100k writes/5GB per day) covers v1.0 with large headroom \|` |
| 68 (ORM row) | `Drizzle ORM / Kit \| 0.45.4 / 0.31.11 \| SQL-first, no engine binary, edge-compatible` | append `; dialect: sqlite` to rationale — `\| … \| SQL-first, no engine binary, edge-compatible; **sqlite dialect** (ADR-13) \|` |
| 93–94 (components) | `\| src/lib/db/schema.ts \| Drizzle schema: auth tables + domain tables \| — \|` and `\| src/lib/db/index.ts \| Lazy Neon HTTP client singleton \| @neondatabase/serverless \|` | row 93: append `(sqlite dialect — the only file with dialect types)`; row 94 → `\| src/lib/db/index.ts \| Lazy D1 client singleton — the single swap point \| drizzle-orm/d1, @opennextjs/cloudflare (binding) \|` |
| 124 | `Money is stored as \`BIGINT\` **minor units** (1/100 rupiah).` | `Money is stored as 64-bit **minor units** (1/100 rupiah) — SQLite \`INTEGER\` via Drizzle \`integer({ mode: 'bigint' })\`.` |
| 126–137 (entity table) | `Store` column value `Postgres` on 8 rows | replace **all** `| Postgres |` → `| D1 |` in §5 |
| 145 | `**Migrations.** \`drizzle-kit generate\` produces committed SQL; \`drizzle-kit migrate\` applies it to Neon.` | `**Migrations.** \`drizzle-kit generate\` produces committed SQL; \`wrangler d1 migrations apply\` applies it to D1 (\`--local\` for dev, \`--remote\` for production).` (keep expand/contract sentence) |
| 147 | `Deletion cascades from \`workspaces\`; Neon PITR expires within the BRD's 30-day purge window.` | `Deletion cascades from \`workspaces\` (D1 enforces foreign keys by default, so \`ON DELETE CASCADE\` behaves as designed); backup retention follows Cloudflare's D1 plan — **verify against BRD NFR-06's 30-day purge window at release (PEP M5)**; D1 has no Neon-style PITR.` |
| 155 (integrations row) | `\| Neon Postgres \| All persistence \| \`DATABASE_URL\` secret \| Explicit 503 + retry; \`/api/health\` reports \`db: down\` \|` | `\| Cloudflare D1 \| All persistence \| D1 binding in \`wrangler.jsonc\` (config, not a secret) \| Explicit 503 + retry; \`/api/health\` reports \`db: down\` \|` |
| 168 (secrets) | `Production secrets via \`wrangler secret put\` (\`DATABASE_URL\`, \`BETTER_AUTH_SECRET\`, \`RESEND_API_KEY\`)` | `Production secrets via \`wrangler secret put\` (\`BETTER_AUTH_SECRET\`, \`RESEND_API_KEY\`); the D1 binding is configuration in \`wrangler.jsonc\`, not a secret` |
| 183 (scalability) | `Neon HTTP avoids pool exhaustion` | `the D1 binding avoids connection pooling` |
| 185 (portability row) | `Standard Postgres + standard Node runtime; no proprietary data stores \| Exit to another host ≤ 2 days` | `Drizzle query builder only (no raw SQL); dialect types confined to \`schema.ts\`; one client module as the swap point (P1–P8) \| Exit to another SQL database ≤ 2 days (swap = 3 steps, AGENTS §1)` |
| 186 (cost row) | `Workers free tier, Neon free/launch, no object storage` | `Workers + D1 free tier, no object storage` |
| 194 (dev env) | `local Postgres branch` | `local D1 (Miniflare, via wrangler)` |
| 195 (preview env) | `Per-PR Worker preview + Neon branch` | `Per-PR Worker preview + local D1; a deployed preview binds its own \`sahfund-preview\` D1 database (never production)` |
| 199 | `Neon branches give preview and test environments a real Postgres without copying production data.` | `Local D1 (Miniflare) gives tests a real SQLite engine with zero data copying; per-PR preview Workers get an isolated D1 database so no environment ever reads production rows.` |
| 208 (ADR-02) | `\| ADR-02 \| Postgres driver \| \`neon-http\` \| … \|` | `\| ADR-02 \| Postgres driver (**superseded by ADR-13**) \| \`neon-http\` \| … \|` (row kept for history) |
| 219 (new row) | — | **Add ADR-13:** `\| ADR-13 \| Database \| Cloudflare D1 (SQLite) via \`drizzle-orm/d1\` \| Neon Postgres (supersedes ADR-02), Turso, Hyperdrive+Postgres, local SQLite file \| Same platform as the Worker (ADR-01); free tier dwarfs v1.0 load; zero users now, so the swap costs nothing. Portability preserved by convention, not by a layer: all access through Drizzle's query builder, dialect types only in \`schema.ts\`, one client module as the swap point — a future swap = dialect + one import + regenerated migrations (AGENTS §1 P1–P8). Rejected: repository/abstraction layer (AGENTS §5 forbids speculative layers); Turso (second vendor, no benefit at this scale) \|` |
| 231 (gotcha 4) | `**\`neon-http\` has no interactive transactions.** \`db.transaction()\` will not work; …` | `**D1 has no interactive transactions.** \`db.transaction()\` will not work; write the import row and its transactions with \`db.batch()\` (atomic — a failure rolls the whole sequence back) so a partial import cannot happen.` |
| 237 (gotcha 10) | `**… \`neon-http\` has no \`db.transaction()\` (gotcha 4), …**` | `**… D1 has no \`db.transaction()\` (gotcha 4), …**` (rest verbatim) |
| 239 (test strategy) | `Integration: import → persist → report against a Neon branch, including a duplicate re-import.` | `Integration: import → persist → report against a local D1 (Miniflare), including a duplicate re-import.` |
| 253 (glossary) | `\| neon-http \| Neon's stateless HTTP driver; no interactive transactions \|` | `\| D1 \| Cloudflare's managed SQLite; binding-based, no connection pool; \`db.batch()\` is atomic; no interactive transactions \|` |
| 255–256 (glossary) | `\| PITR \| … \|` and `\| PITR window \| … \|` | **Delete both rows** (Neon-specific; N5 carries the retention story) |

### 5.3 docs/projects/BRD.md — and the `BRD §3` correction

> **Verified (F12): `BRD §3` (Out of Scope, lines 45–57) never excluded D1.** No edit is needed there. The brief's "BRD §3 exclusion list" refers to content that lives in `AGENTS §10`, `USER-STORIES.md:35`, `ERD.md:433`, and `ITA.md:49` — all edited above/below. BRD edits are only:

| Line | Current (quote) | Replace with |
|---|---|---|
| 225 (NFR-05) | `\| NFR-05 \| Portability: standard Postgres and a standard Node runtime \| Migration off the host ≤ 2 engineering days \|` | `\| NFR-05 \| Portability: standard SQL behind Drizzle (dialect isolated in schema.ts + one client module); standard Node runtime \| Migration off the host ≤ 2 engineering days \|` |
| 253 (diagram) | `│ Postgres (Neon)              │` | `│ Cloudflare D1 (SQLite)       │` |

### 5.4 docs/projects/PEP.md

| Line | Current (quote) | Replace with |
|---|---|---|
| 53 | `- [ ] Neon project (ap-southeast-1) + dev/preview branches — Uwi — ~0.25d` | `- [ ] D1 database (\`wrangler d1 create\`) + \`wrangler.jsonc\` binding + OpenNext dev context — Uwi — ~0.5d` (superseded by T2 of this spec; keep as the tracking row) |
| 54 | `- [ ] Drizzle schema + first migration applied — Uwi — ~0.25d` | append `(sqlite dialect; applied with \`wrangler d1 migrations apply\`)` |
| 109 (risk R2) | `\| R2 \| \`neon-http\` cannot do interactive transactions \| M \| M \| Use \`db.batch()\` for import + rows; test a forced mid-import failure \| Any partial import observed \|` | `\| R2 \| D1 cannot do interactive transactions \| M \| M \| Use \`db.batch()\` for import + rows (D1 batch is atomic per current Cloudflare docs — verify with a forced mid-import failure) \| Any partial import observed \|` |
| ~111 (risk R4, if it cites SQLSTATE/handler counting — verify at T8) | any `SQLSTATE 23505` or "handler counts members" phrasing | reword to `isUniqueViolation()` / DB-constraint phrasing per new `AGENTS §3` |
| 124 | `\| Integration \| Import → persist → report; re-import the same month \| \`node:test\` + Neon branch \| Zero duplicate rows; totals unchanged \|` | `\| Integration \| Import → persist → report; re-import the same month \| \`node:test\` + local D1 (Miniflare) \| Zero duplicate rows; totals unchanged \|` |
| 139 | `Data: no production data is copied into preview. Preview branches are disposable.` | `Data: no production data is copied into preview. Local D1 state and \`sahfund-preview\` are disposable.` |
| 178 | `\| Dependency \| Neon project in \`ap-southeast-1\` \| Latency rises; PITR window unchanged \|` | `\| Dependency \| Cloudflare account with D1 enabled (default) + \`@opennextjs/cloudflare\` binding layer (T2, overlaps M1) \| Deploy target changes; ITA ADR-01/ADR-13 revisited \|` |

### 5.5 Other files

| File | Line | Current (quote) | Replace with |
|---|---|---|---|
| `docs/projects/USER-STORIES.md` | 35 | `… roles beyond owner/member · wedding-organizer multi-client mode · KV/R2/D1/server-side session cache.` | `… roles beyond owner/member · wedding-organizer multi-client mode · KV/R2/server-side session cache.` (**D1 lifted**) |
| `docs/projects/ERD.md` | 433 | `… KV/R2/D1/server-side session cache. If a feature here ever needs one of these …` | `… KV/R2/server-side session cache. If a feature here ever needs one of these …` (**D1 lifted**) |
| `docs/projects/ERD.md` | 8 (status note) | `… \`apps/frontend/src/lib/db/index.ts\` contains only the lazy \`neon-http\` client …` | `… contains only the lazy D1 client (\`drizzle-orm/d1\`) …` (T8, after T3) |
| `docs/projects/ERD.md` | 14 | `Types are illustrative PostgreSQL types, …` | `Types are illustrative; the implemented dialect is SQLite/D1 — see SPEC-d1-migration §6 for the Postgres→SQLite mapping. …` |
| `README.md` | 10 | `\| Database \| Neon Postgres (ap-southeast-1) via the \`neon-http\` driver \|` | `\| Database \| Cloudflare D1 (SQLite) via \`drizzle-orm/d1\` \|` |
| `README.md` | 12 | `\| Auth \| Better Auth — sessions in our own Postgres \|` | `\| Auth \| Better Auth — sessions in our own database (D1) \|` |
| `README.md` | 14 | `\| Money \| \`BIGINT\` minor units (1/100 rupiah) \|` | `\| Money \| 64-bit integer minor units (1/100 rupiah) \|` |
| `README.md` | 21 | `**Multi-table writes use \`db.batch()\`, never \`db.transaction()\`.** The \`neon-http\` driver has no interactive transactions (ITA ADR-02) — …` | `**Multi-table writes use \`db.batch()\`, never \`db.transaction()\`.** D1 has no interactive transactions (ITA ADR-13); \`db.batch()\` is atomic — …` |
| `README.md` | 38 | `├── lib/         db schema + Neon client, session helpers, report aggregates` | `├── lib/         db schema + D1 client, session helpers, report aggregates` |
| `README.md` | 53–58 | `Environment: the Neon project link (\`.neon\`) lives in \`apps/frontend\`. Fill \`.env\` from Neon (Neon CLI required): … neon env pull …` | `Environment: no database URL is needed — D1 arrives as a Worker binding from \`wrangler.jsonc\`. Local dev state lives in \`.wrangler/\` (gitignored). Apply migrations locally with:\n\n\`\`\`bash\ncd apps/frontend\nnpx wrangler d1 migrations apply sahfund --local\n\`\`\`\n\nSecrets (future: \`BETTER_AUTH_SECRET\`, \`RESEND_API_KEY\`) go in \`.dev.vars\` (gitignored).` |
| `README.md` | 82 | `503 → … when Postgres is unreachable` | `503 → … when D1 is unreachable` |
| `apps/frontend/.env.example` | 12–28 | `DATABASE_URL=`, `DATABASE_URL_UNPOOLED=`, `NEON_AUTH_*`, `AWS_*`, `NEON_REALTIME_*` | Replace whole body: comment `# No database URL — D1 is a Worker binding declared in wrangler.jsonc.` + `# Secrets (BETTER_AUTH_SECRET, RESEND_API_KEY) go in .dev.vars — never committed.` + keep the "NEVER commit .env" warning. |
| `docs/README.md` | (index) | — | Add index entry: `- [SPEC — D1 migration](projects/SPEC-d1-migration.md) — change spec (not a source of truth)` |

**Files deleted (T4):** `apps/frontend/neon.ts`, `apps/frontend/.neon/` (project link). **Files added (T2/T5):** `apps/frontend/wrangler.jsonc`, `apps/frontend/drizzle.config.ts`, `src/lib/db/schema.ts` (empty placeholder barrel — F1).

### 5.4b Grep residue check (gate for T8)

After the sweep, this command must return **only** the allowlisted hits:

```
grep -rniE "neon|neon-http|DATABASE_URL|Postgres" --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.example" .
```

**Allowlist (deliberate residue):** `ITA.md` ADR-02 row (marked *superseded*), `PEP.md` historical risk rows only if quoted verbatim as history, `SPEC-d1-migration.md` itself (this file), `skills-lock.json`/`.agents/` (Neon skill *packages* — removal is optional tooling cleanup, T4 note), `package-lock.json` (until T4's reinstall prunes it).

---

## 6. Schema portability analysis (deliverable 3)

**Scope note (F1/F2):** there is no `schema.ts` to inventory. The analysis below covers **every Postgres-specific construct the schema *will* contain**, transcribed from `ERD.md` (the pre-schema source) and `ITA §5`. This is the authoritative mapping the future schema author must follow; it is what makes the first migration D1-native instead of a later conversion.

### 6.1 Type mapping — every construct accounted for

| ERD/ITA construct (planned) | Postgres type | D1/SQLite equivalent (Drizzle) | Dialect difference lives in | Flag |
|---|---|---|---|---|
| `id`, `email`, `name`, `token`, `inviteCode`, `ref`, `source`, `direction`, `role`, `kind`, `status`, `plan`, `vendor`, `description` | `text` | `text()` | `schema.ts` | Clean port. |
| `emailVerified`, `reconciled` | `boolean` | `integer({ mode: 'boolean' })` (0/1) | `schema.ts` | Clean; reads back as JS boolean. |
| `expiresAt`, `createdAt` (instants) | `timestamptz` | `integer({ mode: 'timestamp_ms' })` (epoch ms, UTC) | `schema.ts` | Clean; matches Better Auth's SQLite convention. Format `id-ID` at render only (existing money/date rules). |
| `weddingDate`, `occurredOn`, `dueOn` (date-only) | `date` | `text()` storing ISO `YYYY-MM-DD` | `schema.ts` | SQLite has no date type; ISO text sorts lexicographically = chronologically, so `ORDER BY`/range `WHERE` behave identically. **No `date` mode exists for SQLite in Drizzle — do not attempt one.** |
| `budgetTargetMinor`, `amountMinor`, `balanceMinor`, `budgetMinor`, `totalMinor`, `paidMinor` | `bigint` | `integer({ mode: 'bigint' })` — **always 64-bit** | `schema.ts` | **Must** use `mode: 'bigint'` (P5). Never `real`. Verify D1 round-trips values > 2^53 (T5 test; §11 R5). |
| `txCount`, `sort` | `integer` | `integer({ mode: 'number' })` (default) | `schema.ts` | Clean. |
| `imports.issues` | `jsonb` | `text({ mode: 'json' })` | `schema.ts` | **No JSON path operators in SQLite queries.** Rule: read the row and filter in JS (`issues` is always whole-row reads). P6 bans `->>`/`@>` style fragments. |
| enum-like columns (`direction`, `role`, `status`, `kind`, `plan`) | planned as `text` already (ERD: "values not enumerated") | `text()` + **Zod enum at the boundary** (shared schema, `AGENTS §6`) | `schema.ts` + existing Zod | **No `pgEnum`** — SQLite has none; and none was planned. Clean. |
| PKs (`user.id`, `workspaces.id`, …) | `text` (app-generated) | `text()` + `$defaultFn(() => crypto.randomUUID())` | `schema.ts` | App-generated ids (P6) — **no `serial`/`gen_random_uuid()`**, no dialect function. |
| `UNIQUE (workspaceId, dedupeHash)`, `UNIQUE inviteCode`, `UNIQUE (workspaceId, name)`, `session.token UNIQUE`, **`members UNIQUE (userId)`** (one workspace per user), **`members UNIQUE (workspaceId, role)`** (one owner + max two members — `AGENTS §3`) | unique constraints/indexes | identical — composite `unique()` supported; `UNIQUE (workspaceId, role)` works because `role ∈ {owner, member}` caps the table at 2 rows/workspace even before the CHECK evaluates | `schema.ts` | Clean. Race-condition strategy (`AGENTS §3`) unchanged: the unique index absorbs concurrent duplicates. |
| **`CHECK (role IN ('owner','member'))`** (`AGENTS §3`) | CHECK constraint | CHECK constraint — SQLite/D1 support `CHECK`; D1 evaluates it on every write (`ignore_check_constraints` defaults off) | `schema.ts` (P1 allowlist (a): constraint expression) | Clean. Must be expressed in the schema, not the handler (`AGENTS §3`: "DB constraints, not handler counts"). |
| **Constraint-violation → 409 mapping** (`AGENTS §3`: "handler maps SQLSTATE 23505") | `SQLSTATE 23505` | **Does not port** — SQLite/D1 raises `SQLITE_CONSTRAINT_UNIQUE` / `D1_ERROR: UNIQUE constraint failed: …`, no SQLSTATE | **`db/index.ts` only** — export `isUniqueViolation(err)` (P3); handlers call it, never string-match errors themselves. *Lands with the first write handler (PEP M1 workspace/join task) — no caller exists in this change (YAGNI).* | ⚠ **Flagged.** The handler contract ("clear 409-style message", BRD FR-02) is preserved; only the detection mechanism is dialect-scoped. Postgres `23505` must not appear in handler code (grep gate, P3). |
| Indexes: `transactions(workspaceId, occurredOn)`, `transactions(categoryId)`, `session(userId)`, `imports(workspaceId, createdAt)`, `commitments(workspaceId, dueOn)` | b-tree indexes | identical composite/single indexes | `schema.ts` | Clean — no GIN, opclass, or partial indexes planned. `AGENTS §4` index guidance stays valid as written. |
| FKs + `ON DELETE CASCADE` from `workspaces` (PDP deletion, `BRD NFR-06`) | FK cascade | FK cascade — **D1 enforces FKs by default** (verified, Cloudflare docs) | `schema.ts` | Clean; no `PRAGMA foreign_keys` wiring needed (D1 runs every query with it on). |
| `dedupe_hash = sha256(...)` (`ITA §5`) | computed… where? | **app-side only** — one pure function (crypto.subtle / `node:crypto`, available under `nodejs_compat`) | `src/core` or `src/lib` (single function) | **Does NOT port to SQL** — SQLite/D1 has no `sha256()`. P6 makes this a rule; unit test mandatory (hash is money-adjacent correctness). |
| money aggregation `SUM`/`GROUP BY` (`AGENTS §4`) | `SUM(bigint)` | `SUM(INTEGER)` — returns INTEGER unless int64 overflow (≈ 9.2×10¹⁸ minor units ≈ Rp 92 quadrillion per aggregate) | call sites unchanged | Non-issue at product scale; keep sums in SQL (no fetch-all-then-reduce). |
| `CURRENT_TIMESTAMP` defaults | DB default | **app-side** `$defaultFn` (P6) | `schema.ts` | Avoids dialect `DEFAULT` drift. |

### 6.2 Query-semantics constructs

| Construct | Status under D1/Drizzle | Note |
|---|---|---|
| `onConflictDoUpdate` / `onConflictDoNothing` (dedupe re-import) | **Supported** — SQLite upsert; conflict target must be the unique index `(workspaceId, dedupeHash)`, same as PG. `excluded.*` works. | Semantics match for our use (re-import = no-op → `onConflictDoNothing`). |
| `.returning()` | **Supported** (D1's SQLite ≥ 3.35). | Needed for `insert … returning id` flows. |
| `sql\`` template fragments | **Banned** (P1) except the `select 1` probe. | The future import code composes statements from the query builder + `.batch()`. |
| Raw JSON/JSONB operators, arrays, `ILIKE`, `now()`, partial indexes, `ON CONFLICT WHERE` | **Not available / banned** (P6). | Nothing in ERD/ITA requires them. |
| Interactive `db.transaction()` | **Unavailable** (same as neon-http). | P7; `db.batch()` is the atomic primitive and is *stronger* documented here than neon's batch. |

### 6.3 Money rule (restated as a spec invariant)

- Storage: `integer({ mode: 'bigint' })` on every `*Minor` column; SQLite `INTEGER` = 64-bit always.
- Arithmetic: never in floats; aggregation in SQL (§6.1); parsing/formatting only via `src/core/money.ts` (`AGENTS §7`).
- JSON boundary: BigInt does not survive `JSON.stringify` — any route that returns money must convert through the existing money formatter (string like `Rp 1.234.567`) as it already must for display (BRD NFR-09). *Edge case to watch when the first money-returning endpoint is built — not this change.*

### 6.4 What a future swap actually touches (proof of P8)

| Step | File | Change |
|---|---|---|
| 1 | `src/lib/db/schema.ts` | `drizzle-orm/sqlite-core` → `drizzle-orm/pg-core`; adjust the 4 non-1:1 types (§6.1: boolean, timestamp_ms, date-text, json). |
| 2 | `src/lib/db/index.ts` | `drizzle-orm/d1` → chosen driver (`drizzle-orm/neon-http` or `/node-postgres`); binding lookup → connection URL. |
| 3 | tooling | `drizzle.config.ts` dialect + regenerate migrations. |

Zero call-site changes — because P1–P3 keep every dialect decision inside those two files. **This table is the acceptance test for the portability claim** and is quoted in the `AGENTS §1` edit (T8).

---

## 7. Driver / client swap plan (deliverable 4)

### 7.1 Dependency & runtime prerequisites (T2 — pulled forward from PEP M1)

D1 exists only as a Workers binding (F6). Required before the swap:

1. Install (pinned per `ITA §3`): `@opennextjs/cloudflare@1.20.15`, `wrangler@4.156.1` (dev), plus `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`, `@cloudflare/workers-types` (dev).
2. `wrangler d1 create sahfund` → capture `database_id`.
3. Create `apps/frontend/wrangler.jsonc`: `name`, `main: ".open-next/worker.js"`, `compatibility_flags: ["nodejs_compat"]`, `compatibility_date`, `assets` → `ASSETS`, and:
   `d1_databases: [{ binding: "DB", database_name: "sahfund", database_id: "<id>", migrations_dir: "drizzle" }]`.
   Environments: `preview` gets its own `database_id` (`sahfund-preview`) so a deployed preview never reads production rows (§5.2 line 195).
4. `next.config.ts`: add `initOpenNextCloudflareForDev()` (from `@opennextjs/cloudflare`) so `next dev` serves a **locally simulated D1** through wrangler's platform proxy.
5. `.gitignore`: add `.wrangler/` (local D1 state) — verify existing `.open-next` entries stay.

> **Overlap to coordinate:** steps 1–4 are also PEP M1's "OpenNext deploy to Workers" task. This spec claims only the *binding prerequisite*; the full deploy/preview pipeline remains M1. Do not double-build.

### 7.2 New shape of `src/lib/db/index.ts` (interface contract — not implementation)

- Exports kept: `getDb()`, `probeDb()` — **call-site compatibility**; `getSql()` renamed to `getDb()` (sole consumer is `probeDb` + health route; grep-verified F3).
- `getDb()`: lazy singleton; resolves the binding via `getCloudflareContext().env.DB` (OpenNext API — verify exact accessor against 1.20.x at implementation); **throws at request time if the binding is missing** (preserves today's lazy `DATABASE_URL` failure — `ITA §2`); wraps with `drizzle(env.DB, { schema })` (schema passed once `schema.ts` exists).
- `probeDb()`: same 3 s bound (B2, `Promise.race` + `AbortSignal.timeout` timer; comment that D1 calls cannot be aborted); executes the allowlisted `select 1`.
- `src/app/api/health/route.ts`: **no change** — its catch-all already maps any throw → 503 with the generic Bahasa message (B1).

### 7.3 `db.batch()` — how calls change (they don't)

- **Call sites today: zero** (F3). No code edits.
- API: `drizzle-orm/d1` exposes `db.batch([...])` with the same name/shape as neon-http's — future import code written to `AGENTS §2` transfers unchanged.
- Semantics: D1's `batch()` is documented as a transaction — "if a statement in the sequence fails … it aborts or rolls back the entire sequence" (Cloudflare D1 docs). This *strengthens* the neon-era guarantee; PEP risk R2's forced-failure test (T7 harness) verifies it rather than trusting the doc (§11 R2).

### 7.4 503-on-DB-down under D1 (ITA §2 / NFR-07 mapping)

| Failure | Detection | Response |
|---|---|---|
| Binding missing (dev without `initOpenNextCloudflareForDev`, prod misconfig) | `getDb()` throws at first use | 503 + retry message (identical to today's missing `DATABASE_URL`) |
| D1 overloaded / quota / error | binding call rejects | caught by health/route catch-all → 503; generic message only (B6) |
| Hung query | probe race timer (3 s) | 503; background call may continue — accepted, commented |

### 7.5 Better Auth — current stub state and future requirement (**blocker-adjacent, out of scope here**)

- **Verified:** Better Auth is *not installed*; `/api/auth` is a Zod-validating 503 stub with a `shortcut:` comment (F8). No auth tables exist anywhere. Auth wiring is PEP M1 / US-01, a separate change.
- **Requirement recorded so this migration does not foreclose it:** when auth lands on D1 it must use `drizzleAdapter(db, { provider: "sqlite" })` against the *same* `getDb()` instance (no second client — `AGENTS §7`), and auth tables must be generated with `npx @better-auth/cli generate` configured for **sqlite** (`ITA §11.6` — never hand-written).
- **Version pin:** pin a Better Auth release containing the D1 fixes — schema-validation-on-D1 (better-auth issue #11366, closed) and drizzle-sqlite date writes (#10816, closed) — and prove it with a sign-up smoke test at wiring time. *Do not pick the version in this change; record the requirement in the auth task's AC.*
- Sequencing: **auth must land after T3** (it needs `getDb()`); nothing in this spec blocks it.

---

## 8. Migrations plan (deliverable 5) — one concrete path

**Chosen path (the only one): `drizzle-kit generate` → committed SQL → `wrangler d1 migrations apply`.**

| Step | Command / artifact | Notes |
|---|---|---|
| 1 | `wrangler d1 create sahfund` (T2) | Produces `database_id` → `wrangler.jsonc`. |
| 2 | `drizzle.config.ts` (T5): `dialect: "sqlite"`, `schema: "./src/lib/db/schema.ts"`, `out: "./drizzle"` | `generate` is offline — no `dbCredentials` needed. |
| 3 | `src/lib/db/schema.ts` (T5) | Created as an **empty placeholder barrel** (exports nothing yet) so the pipeline runs end-to-end; first real tables arrive with auth/import (PEP M1/M2) under §6.1's mapping. |
| 4 | `drizzle-kit generate` → `drizzle/*.sql` + journal, **committed** | Same review discipline as `AGENTS §2` always required. |
| 5 | Apply: `wrangler d1 migrations apply sahfund --local` (dev) / `--remote` (production) | Wrangler records history in D1's `d1_migrations` table. |

**Rejected alternatives (and why):**

- `drizzle-kit push` — produces **no committed SQL**; violates `AGENTS §2` ("committed SQL") and is unreviewable. Offline sketching only, never the path.
- `drizzle-kit migrate` / runtime `migrate()` from `drizzle-orm/d1/migrator` — applies at runtime from app code; couples deploy to schema change, hides history. Wrangler's CLI is the canonical, explicit path.
- `drizzle-kit` `d1-http` driver (accountId/token) — only needed for kit *remote* commands; adds a token to CI for no benefit given the wrangler path.

**"Regenerate from scratch" / no production data:** confirmed — 0 users, **no existing schema, no existing migration SQL, no `drizzle-kit migrate` against Neon ever ran** (F1/F2). There is literally nothing to convert: the first `generate` on the sqlite dialect *is* the baseline. Expand/contract discipline (`ITA §5`) still applies to all future migrations — it is a habit, not a response to this swap.

**CI implications (F7 — CI does not exist yet; T7 defines it):**

| Gate | Command |
|---|---|
| typecheck | `tsc --noEmit` |
| unit | `node --test` (existing `src/core/core.test.ts` + new hash test) |
| lint **incl. portability rules P1–P6** | `eslint` (restrictions added in T5) — must fail on a seeded violation (M3) |
| schema drift | `drizzle-kit generate && git diff --exit-code drizzle/` |
| integration | Miniflare D1 harness (§9) |
| e2e | Playwright against Workers preview (T6) — same runner as today, new webServer |

---

## 9. Preview / integration test replacement (deliverable 6)

Neon branches (`ITA §9`, `PEP §7`, `PEP:124`) are gone. Three tiers:

| Tier | Today | Replacement | Task |
|---|---|---|---|
| **Integration** (`PEP §7`: import → persist → report + duplicate re-import) | `node:test` + Neon branch (never built) | **In-process Miniflare** (devDep) with a `d1Databases` binding; helper `test/helpers/d1.ts` boots Miniflare, reads `drizzle/*.sql`, applies in order through the binding, returns `drizzle(db)`; teardown disposes. Test file: import → persist → report + duplicate re-import asserting *zero duplicate rows, totals unchanged*. | T7 |
| **E2E** (`e2e/requirements.spec.ts`, incl. `db:"up"` assertion) | `npm run build && npm run start` (plain Node — no binding possible, F11) | Playwright webServer → `opennextjs-cloudflare build && wrangler dev --port 3100` (Workers runtime, **local simulated D1**); migrations applied by a `pretest` step (`wrangler d1 migrations apply --local`). | T6 |
| **Preview (per-PR deploy)** | Neon branch | Local sim for tests; a *deployed* preview binds `sahfund-preview` (own `database_id`, wrangler env) — never production. Disposable (`PEP:139` rewritten). | T2 (config), T8 (docs) |

**Why these and not the alternatives:**

- `@cloudflare/vitest-pool-workers` — rejected: `AGENTS §1` fixes the test stack at `node:test` + Playwright; swapping runners for this change is scope creep.
- `better-sqlite3` as the test engine — rejected: different SQLite build; would **not** exercise D1's batch atomicity, FK-by-default, or invocation limits — precisely the semantics we must verify.
- `wrangler d1 execute` subprocess per test — rejected: slow, untyped, no Drizzle in the loop.
- Remote D1 for tests — rejected: free-tier quota churn, CI needs Cloudflare credentials, slower; local Miniflare runs the same D1 engine semantics.

**Coverage note:** the full `PEP:124` scenario's *code* (import endpoint) does not exist yet (M2). T7 lands the **harness + a smoke test now** (migrations apply + probe round-trip); the import scenario test attaches to the harness when M2 lands — with this spec's §9 as its recipe, so nobody re-introduces a Neon branch.

---

## 10. Edge cases & failure modes

| # | Scenario | Expected behaviour |
|---|---|---|
| E1 | Dev server started without `initOpenNextCloudflareForDev` / binding missing | `getDb()` throws at request time → health 503, message unchanged (B1). Never a build-time crash (preserves the lazy-client rationale in the current file header). |
| E2 | Two partners re-import the same month concurrently | Both requests succeed; `UNIQUE (workspaceId, dedupeHash)` drops the overlap (`AGENTS §3`). Same as Postgres — no locks added, per the standing rule. |
| E3 | Import batch hits D1 limits at 5,000 statements (BRD FR-03 max) | Official docs: a `batch()` counts as **one** query per Worker invocation; each statement ≤ 100 KB; query duration ≤ 30 s. **Must be verified at 5,000 rows in the T7 harness** (R3). If it fails: **do not silently chunk** — chunking breaks atomicity (`AGENTS §2`); escalate as a BRD FR-03 question. |
| E4 | Money value > 2^53 minor units | Would lose precision if D1 returned JS numbers. Mitigation: `mode: 'bigint'` (P5) **plus** a T5 round-trip test at `2^53 + 1`. If D1 fails it: document the supported range (2^53 minor units ≈ Rp 90 trillion per row — far beyond the product) and add a write-time guard at the first money endpoint. |
| E5 | Probe against a hung D1 | 3 s race → 503; background call continues (accepted, commented — B2). |
| E6 | `imports.issues` read path | Whole-row read, filter in JS — no JSON-path SQL (P6). |
| E7 | Server component later reads D1 under `cacheComponents` | Use OpenNext's **async** context mode for SSG/RC paths (verify at first use); out of scope now (no component reads the DB yet) — flagged so the first author doesn't hit the sync-context error. |
| E8 | Deployment/rollback mid-migration | Migrations are forward-only in D1; rollback = revert code commits + optionally recreate the D1 DB (0 data). Expand/contract keeps old code compatible with new schema during any future rollout (`ITA §5`). |
| E9 | Secrets regression | `DATABASE_URL` removed from `.env.example`, docs, and secret lists (T4/T8); grep gate M2 catches reintroduction. D1 `database_id` in `wrangler.jsonc` is committed config (Cloudflare-documented practice), **not** a secret. |
| E10 | Concurrent attempt at a second workspace / third member / duplicate invite | Constraint fires inside D1's implicit write transaction → error propagates → `isUniqueViolation()` (P3, lives in `db/index.ts`) → 409-style message (BRD FR-02). **No handler counting, no prior-read reservation** (`AGENTS §3`). If the violation occurs inside a `db.batch()`, D1 rolls the whole batch back — no partial membership row (stronger than needed, correct). |

---

## 11. Risk register (deliverable 8)

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | Repo is far earlier than briefed (F1–F7): no schema, no Drizzle, no wrangler, no CI — the "migration" is mostly *first-time setup + docs*, but it is **coupled to the unwired OpenNext binding layer** (F6) | H | M | T2 explicitly claims only the binding prerequisite and coordinates with PEP M1 (no double-build); estimates in §12 reflect setup-not-conversion |
| R2 | D1 `batch()` atomicity: official docs (rev. 2026-01-19) say transactional/rollback; the older `@cloudflare/d1` README says *not* atomic — contradictory sources | L | H (import correctness) | Treat current official docs as authoritative; **verify with a forced mid-batch failure test** in the T7 harness (this is PEP R2's existing test, re-pointed at D1) |
| R3 | 5,000-statement import batch vs D1 per-invocation/size/duration limits (E3) | M | H | Verify at 5,000 rows in T7 *before* M2 builds the endpoint; failure escalates to BRD FR-03 — never silent chunking |
| R4 | Better Auth × D1 known issues (schema validation #11366, date writes #10816) | M (when auth lands) | M | §7.5 records: pin a fixed version, `provider: "sqlite"`, CLI-generated tables, sign-up smoke test — enforced as AC of the *auth* task, not this one |
| R5 | D1 integer round-trip > 2^53 (E4) | L | H (money) | T5 test at `2^53+1`; `mode: 'bigint'` (P5); documented range + guard if it fails |
| R6 | Doc drift across 12+ files (§5) | H | M | Single docs sweep (T8) + grep residue gate (§5.4b) + senior review (T9) |
| R7 | D1 free-tier ceilings (100k writes/day, 5M reads/day, 5GB) reached if growth outruns forecast | L | M | Current load ~170 writes/day ≈ 0.2% of quota; monitor via Workers Logs; revisit at paid tier — **not** a v1.0 concern (user-confirmed) |
| R8 | OpenNext/Next 16/wrangler peer drift (existing PEP R3) | M | M | Pin exact versions (`ITA §3`: 1.20.15 / 4.156.1 / Next 16.4.3); wrangler ≥ 3.99 required by adapter |
| R9 | Retention/PDP: D1 backup story ≠ Neon PITR; `BRD NFR-06` purge ≤ 30 days depends on it | M | M | ITA:147 edit carries an explicit **verify-at-release** note; deletion itself is immediate + cascading (N5); checklist item for PEP M5 |
| R10 | E2E runtime switch (wrangler dev in Playwright) flakier than `next start` | M | M | Keep `reuseExistingServer`, explicit port; fallback documented: assert health against `next dev` (bindings also available via platform proxy) if wrangler-dev proves unstable in CI |

---

## 11.1 Rollback

1. **Code:** `git revert` the change commits in reverse order (T1→T8 are separable; docs revert cleanly).
2. **Binding:** remove the `d1_databases` block from `wrangler.jsonc`; delete the D1 database (`wrangler d1 delete sahfund`) — **0 users, 0 data, nothing to export** (user-confirmed).
3. **Restoration:** re-add `@neondatabase/serverless` + `DATABASE_URL` per the pre-change commit; the health route and `probeDb` consumers were never edited (F3), so the neon path returns without route changes.
4. **What breaks / what doesn't:**
   - *503 handling:* survives both directions — same catch-all, same message (B1). The only difference is which failure (missing URL vs missing binding) triggers it.
   - *Rate limits:* untouched — edge-level, datastore-agnostic (B7).
   - *Better Auth future wiring:* auth is not installed (F8), so nothing to migrate back; if auth had landed on D1 first, the rollback note is: `drizzleAdapter` `provider` flips `"sqlite"` → `"pg"` (one line) — record in the auth task.
   - *Migrations:* forward-only history in D1 is discarded with the database; no schema existed before this change (F1), so revert restores the *no-database* state exactly.
5. **Data:** no rollback data concern by construction (0 users, disposable Neon data).

---

## 12. Task breakdown (deliverable 7)

Ordered; each task is independently testable. Estimates in person-days with confidence (**H** = well-understood, **M** = some unknowns, **L** = blocked on external API behaviour).

| Task | Description & files | Deps | Est. (conf.) | Specialist | Acceptance criteria |
|---|---|---|---|---|---|
| **T1** | **ADR first** (`PEP §10`): add ADR-13 row + mark ADR-02 *superseded* in `ITA.md` §10 (§5.2 line 219/208). | — | 0.05 (H) | docs | ADR-13 present with alternatives (Neon/Turso/Hyperdrive/local-file) + rationale; ADR-02 visibly superseded. Unblocks code per change-control. |
| **T2** | **Binding bootstrap:** install `@opennextjs/cloudflare@1.20.15`, `wrangler@4.156.1` (dev); `wrangler d1 create sahfund`; `wrangler.jsonc` (nodejs_compat, `d1_databases` binding `DB`, `migrations_dir: drizzle`, preview env with `sahfund-preview`); `initOpenNextCloudflareForDev()` in `next.config.ts`; `.gitignore` += `.wrangler/`. *Coordinate with PEP M1 (F6).* | T1 | 0.5 (M) | devops | `next dev` starts; `getCloudflareContext().env.DB` resolves to a local simulated D1; `wrangler d1 migrations apply sahfund --local` runs (empty). |
| **T3** | **Client swap:** `src/lib/db/index.ts` → lazy `getDb()` via `drizzle-orm/d1` + binding (§7.2); `probeDb()` with 3 s race; health route **untouched**. Add `drizzle-orm@0.45.4`. | T2 | 0.25 (H) | backend | `/api/health` → `200 {db:"up"}` in `next dev`; → `503 {db:"down"}` when binding removed (test both); typecheck green; grep `@neondatabase` in `src/` = 0. |
| **T4** | **Neon removal:** delete `neon.ts`, `.neon/`; remove `@neondatabase/serverless`, `@neon/config`, `@neon/env` from `package.json`; rewrite `.env.example` (§5.5); prune lockfile. | T3 | 0.25 (H) | backend | `npm ls` clean; `grep -ri neon apps/frontend --exclude-dir=node_modules --exclude-dir=.next` = 0; build passes; README env section updated (moves to T8 if preferred — same PR). |
| **T5** | **Drizzle pipeline + portability lint:** `drizzle.config.ts` (sqlite); empty `src/lib/db/schema.ts` placeholder; `drizzle-kit@0.31.11` (dev); ESLint `no-restricted-imports` enforcing **P1–P3** (+ P4 grep pattern documented); unit test: hash function (once written) + D1 round-trip test at `2^53+1` (E4) in the T7 harness. | T3, T4 | 0.5 (M) | backend | `drizzle-kit generate` runs and produces committed baseline (may be empty); seeded portability violation **fails lint** (M3); `2^53+1` round-trip passes. |
| **T6** | **E2E runtime switch:** `playwright.config.ts` webServer → `opennextjs-cloudflare build && wrangler dev --port 3100`; `pretest` applies local migrations; keep `reuseExistingServer`. | T3, T5 | 0.25 (M) | test | `npm run test:e2e` green — all 4 tests incl. `db:"up"` and no-console-error checks. |
| **T7** | **Integration harness + CI:** Miniflare devDep; `test/helpers/d1.ts` (boot → apply `drizzle/*.sql` → `drizzle(db)` → dispose); smoke test (migrations + probe) + **forced mid-batch failure test** (R2) + **5,000-row batch test** (R3) + **unique-constraint-in-batch rollback test** (E10: duplicate insert inside a batch leaves zero rows); unit test for `isUniqueViolation()` against D1's error shape (or `db.batch` rejection shape, deferred to helper-landing if helper not yet written — test the detection contract either way); `.github/workflows/ci.yml`: typecheck, unit, lint (incl. P1–P6), schema-drift, integration (e2e job optional/manual). | T5 | 0.75 (M) | test + devops | All CI jobs green locally-simulated; batch failure rolls back (0 rows); constraint violation inside batch rolls back (0 rows); 5,000-row batch succeeds or the R3 escalation is filed **before** M2; harness documented in README Testing section. |
| **T8** | **Doc sweep:** every edit in §5 (AGENTS ×10, ITA ×19, BRD ×2, PEP ×6, USER-STORIES, ERD ×3, README ×7, `.env.example`, docs/README index); grep residue gate §5.4b passes. | T1–T7 (describes as-built truth) | 0.5 (H) | docs | Residue gate clean per allowlist; every §5 row checked off; `SPEC-d1-migration.md` indexed. |
| **T9** | **Senior review gate** (security/data-path adjacent: DB client, binding/secret handling, health error paths, portability rules, doc accuracy, §13 DoD mapping). | T3–T8 | 0.25 (H) | senior review | Sign-off; findings resolved or ticketed before merge. |

**Totals:** ≈ **3.0 person-days** (M confidence — setup-heavy; conversion work itself is near-zero per F1–F3). Parallelism: T8 (docs) can proceed in parallel with T5–T7 once T3 lands; T6/T7 both depend on T5 but are independent of each other.

### 12.1 Traceability

| Requirement/source | Spec section | Task |
|---|---|---|
| User decision: D1 + convention-based portability | §1, §3.2 | T1, T5, T8 |
| `AGENTS §12` Definition of Done | §13.1 | T9 |
| `ITA §2` 503 / `BRD NFR-07` | §3.1 B1–B2, §7.4 | T3, T6 |
| `AGENTS §2` batch/atomicity | §3.1 B3, §7.3 | T7 (verification) |
| `AGENTS §3` dedupe/sha256 | §6.1, P6 | T5 (rule), hash test |
| `AGENTS §3` new invariants (one workspace/user, one owner + max 2 members, DB-constraint enforcement, 409 mapping) | §3.1 B8, §6.1 (incl. SQLSTATE non-port), §10 E10, P3 | T8 (doc edit), T7 (rollback test), future handler task (`isUniqueViolation`) |
| `AGENTS §5` no abstraction layer | §3.2, §6.4 | T5 (lint), T9 |
| `AGENTS §10` D1 exclusion lift | §5.1, §5.5 | T8 |
| `AGENTS §11` integration vs Neon branch | §9 | T7 |
| `PEP §10` change control (ADR first) | §5.2 ADR-13 | T1 |
| `PEP §7` integration row | §9 | T7 |

---

## 13. Acceptance criteria

### 13.1 Every `AGENTS.md §12` DoD item addressed

| §12 item | How this change satisfies it | Task |
|---|---|---|
| *Mutation: one `db.batch()`, no `db.transaction()`, no check-then-act* | Rule preserved with D1 citation (§3.1 B3, P7); zero mutation code exists to violate it; forced-failure test proves rollback | T7 |
| *Invariant backed by a DB constraint* | SQLite/D1 supports the same UNIQUE/FK/CHECK constraints; FK enforcement **on by default** (N5); no new invariants introduced | T5 (schema when written), T9 |
| *Query scoped by `workspaceId` + membership verified* | Dialect-independent; unchanged (B4) | T9 (review) |
| *No loop-around-query; aggregates in SQL* | Unchanged; §6.1 confirms `SUM(INTEGER)` is safe at product scale | T9 |
| *Body validated with shared Zod; `requireSession()` present* | Untouched (auth not installed — F8) | — (auth task) |
| *Pure logic in `src/core` with unit tests; no floats on money* | P4 (verified clean, F5) + P5 (`mode: 'bigint'`) enforced by lint; hash unit test added | T5 |
| *Server component by default; loading/empty/error/success states* | No UI change in this spec | — |
| *Labels, keyboard, focus* | No UI change | — |
| *Money/dates via `src/core/money.ts`; Bahasa copy* | Unchanged; §6.3 notes the BigInt/JSON boundary for the first money endpoint | — |
| *No new global store; no `useEffect` fetching* | No UI change | — |
| *Reused existing helper/schema/math/component* | Reused `probeDb` shape, health route untouched, `money.ts` untouched — the diff deletes a driver, it does not add layers (F3) | T3 |
| *No v1.0-excluded feature crept in; no row-content logs* | D1 exclusion lifted **explicitly and only** via ADR-13 + 4 doc edits (§5); no logging added (B6) | T1, T8 |
| *Typecheck + unit tests pass; lint-clean* | CI gates created (§8.4) — CI did not exist before (F7) | T7 |

### 13.2 Spec self-verification

- [x] All requirements decomposed into testable ACs (per-task table, §12)
- [x] Impact analysis: data (none — 0 users), API (health contract unchanged), UI (none), infra (wrangler/D1/OpenNext binding), operations (503, rate limits, rollback) — §7, §10, §11.1
- [x] Edge cases: boundary (2^53, 5,000 rows), concurrency (duplicate import), failure (overload, hung probe, missing binding), security (secrets, logs, scoping) — §10
- [x] Risks: all high/medium have mitigations — §11 (R2, R3, R4, R5, R6, R9 explicitly)
- [x] Task breakdown enables parallel streams (T8 ∥ T5–T7; T6 ∥ T7) — §12
- [x] **No implementation code** — interface contracts and edit tables only
- [x] OpenSpec structure: motivation → functional/non-functional → impact → edge cases → risks → task breakdown
- [x] Traceability requirements → sections → tasks — §12.1
- [x] Every Postgres-specific construct accounted for — §6.1/§6.2 (transcribed from ERD/ITA §5, since `schema.ts` does not exist — F1)
- [x] No raw-SQL blind spots — grep-verified: single `select 1` (F4), allowlisted in P1
- [x] Doc edits enumerated exhaustively — §5 (with the `BRD §3` correction, F12)

---

## 14. Out of scope (deliverable 9)

1. **No data migration** — 0 users; Neon data disposable; no dual-write, no backfill (user-confirmed).
2. **No repository/abstraction layer** — rejected by the user; forbidden by `AGENTS §5`. Portability = P1–P8 only.
3. **No Turso, no Hyperdrive, no read replicas, no edge-replica design.**
4. **No v1.0 feature changes** — no new endpoints, no schema authoring for domain tables (arrives with PEP M1/M2 under §6.1), no auth wiring (§7.5), no rate-limit implementation.
5. **No Neon skill-package deletion decision** — `.agents/skills`/`skills-lock.json` cleanup is optional tooling hygiene (allowlisted in §5.4b); flag for the user, not required for correctness.
6. **No CI creation beyond what this change needs** — T7 builds the gates this change must pass; the full PEP M1 CI matrix (preview deploy etc.) remains M1's scope.
