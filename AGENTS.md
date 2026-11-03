# AGENTS.md — SahFund

Rules for anyone (agent or human) writing code in this repo. Written in the voice of a full-stack senior engineer (10+ years across frontend and backend) who has shipped and maintained money-handling systems: **correctness beats cleverness, the database enforces invariants, the UI never lies about state, and the diff stays small.**

Frontend and backend are held to the same bar. A beautiful screen over an unbatched query is a bug; a correct API that renders a blank page on failure is a bug too.

Sources of truth, in order:
1. `docs/projects/ITA.md` — architecture, stack, ADRs (cite as `ITA §N`)
2. `docs/projects/BRD.md` — scope and requirements (cite as `BRD §N`)
3. `docs/projects/PEP.md` — delivery plan and gates

If code and docs disagree, stop and ask — do not silently pick a side.

---

## 1. Stack (fixed — do not swap)

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 16 (App Router) on Cloudflare Workers via OpenNext | `proxy.ts`, not `middleware.ts` (Next 16) |
| DB | Neon Postgres (ap-southeast-1), **`neon-http` driver** | HTTP driver, no connection pool |
| ORM | Drizzle ORM | SQL-first, edge-compatible |
| Auth | Better Auth | sessions in our Postgres |
| Validation | Zod | one schema shared client + server |
| Money | `BIGINT` minor units (1/100 rupiah) | **floats banned** from storage and arithmetic |
| Tests | `node:test` (unit), Playwright (e2e) | |

Pin exact versions in `package.json` (ITA §3). Never add a dependency for what a few lines do.

**Neon skills — use them for database work.** Nine are installed (project scope `SahFund\.agents\skills\` + `skills-lock.json`, also global `C:\Users\USER\.config\opencode\skills\`):

| Skill | Use for |
|---|---|
| `neon` | overview / entry point |
| `neon-postgres` | **the main one for DB work** — SQL, schema, connections, pooled vs direct, migrations, branching, autoscaling, search |
| `neon-postgres-branches` | branch types for dev/test/CI |
| `neon-postgres-egress-optimizer` | diagnosing egress / data-transfer cost |
| `neon-auth` | Managed Better Auth |
| `neon-object-storage` | buckets / S3 |
| `neon-realtime` | live queries |
| `neon-functions`, `neon-ai-gateway` | **not used in v1.0 (§10)** — listed for completeness |

- Freshness check: run `neon skills status` **from the project root `SahFund`, not from `apps\frontend`** — the lockfile lives at the project root, so from `apps\frontend` it falsely reports "No Neon skills". Update with `neon skills update -y`; that can fail on the GitHub API rate limit when unauthenticated — set `GITHUB_TOKEN`.
- Neon docs are the source of truth for Neon-specific behaviour: index `https://neon.com/docs/llms.txt`; append `.md` to any page to fetch it as markdown (e.g. `https://neon.com/docs/introduction/branching.md`). Prefer fetching current docs over training data.
- **Known divergence — do not silently "fix" it:** the Neon skill recommends `node-postgres` + Cloudflare Hyperdrive (or `@neondatabase/serverless` elsewhere), but this project is fixed on **`neon-http`** — a deliberate decision (§1 table, ITA ADR-02). The skill does not override §1. If the hosting runtime changes, revisit §1 explicitly — don't let a skill drift it.

---

## 2. Database writes and "transactions"

**Hard constraint (ITA §11.4, ADR-02): `neon-http` has no interactive transactions. `db.transaction()` WILL NOT WORK on this driver. Do not write it.**

Rules:

- **Multi-table writes go through `db.batch()`** — one atomic batch per request. The import row and its 5,000 transaction rows are written in a single `db.batch()`; a partial import must be impossible.
- Never split one logical write across two requests or two batches. If a handler needs to write to more than one table, collect all statements first, then fire one batch.
- Batch means "all statements queued, then executed" — do not `await` statement A, then decide whether to run statement B based on A's result. That is two round-trips and a race window.
- Migrations: `drizzle-kit generate` → committed SQL → `drizzle-kit migrate`. **Expand/contract only**: add nullable columns and backfill before making anything required, so a Worker rollback never meets an incompatible schema (ITA §5).
- Schema lives in one place: `src/lib/db/schema.ts`. Generate the Better Auth tables with `npx @better-auth/cli generate` and diff — never hand-write auth tables (ITA §11.6).
- If a feature genuinely needs a read-then-write with a decision in between (not an import), treat it as a race-condition problem first — see §3 — the answer is usually a constraint, not a transaction.

---

## 3. Race conditions — enforce invariants in the database

**Rule: the DB constraint is the source of truth. Application-level `check → then → insert` is forbidden as a correctness mechanism.**

Concrete mechanisms already in the schema — use them, don't duplicate them in code:

| Invariant | Enforcement |
|---|---|
| No duplicate rows on re-import | `UNIQUE (workspaceId, dedupeHash)`; `dedupe_hash = sha256(workspaceId \| date \| time \| amountMinor \| balanceMinor \| ref)` |
| One row per invite/code | `inviteCode` UNIQUE; membership `UNIQUE (workspaceId, userId)` |
| One category name per workspace | `UNIQUE (workspaceId, name)` |
| One entitlement grant per order | Idempotent grant keyed by order id (ITA §6) |

Rules:

- **Two-member cap:** the handler counts members *inside* the same batch/insert flow and the unique constraint absorbs the concurrent duplicate. A third join attempt returns a clear 409-style message, never a silent failure (BRD FR-02). Do not "reserve" a slot with a prior read.
- **Idempotent imports:** re-posting the same rows is a no-op by `dedupe_hash`, not an error and not a doubled balance. Never delete-and-reinsert to "refresh" a month.
- **Never trust the client.** The browser computes reconciliation; the server **re-runs the same pure reconciliation function** on the posted rows and stores the server result on the import row (ITA §2). The client's `reconciliation` field is advisory input only.
- **Entitlement webhooks:** process at-most-once per order id. Retry on 5xx is safe because the grant is keyed by order id.
- Reads in a handler assume nothing about what other requests are doing. If two partners import the same overlapping month simultaneously, both requests succeed and the unique index drops the overlap — that is the design; don't add locks.

---

## 4. N+1 queries — batch or join, never loop

- **Never `await` a single-row query inside a loop.** If you're iterating results and fetching a related row per iteration, you've written an N+1. Fix it with `inArray` or a join, in the same function — not with a cache.
- Pattern for "many rows → related entities":

  ```ts
  const ids = rows.map(r => r.categoryId).filter(isNotNull);
  const cats = await db.select().from(categories).where(inArray(categories.id, ids));
  const byId = new Map(cats.map(c => [c.id, c]));
  ```

- Prefer one aggregate query (SQL `SUM`/`GROUP BY` via Drizzle) over fetching rows into JS and reducing — for budget-vs-actual, contributions, and forecast inputs (`src/lib/reports/*`). Money aggregation in SQL must use `BIGINT` sums only.
- Ledger list: filter + paginate in the query (`WHERE workspaceId = ? AND occurredOn BETWEEN ... ORDER BY occurredOn DESC LIMIT/OFFSET`), never fetch-all-then-slice in JS.
- Use the indexes that exist: `transactions(workspaceId, occurredOn)`, `transactions(categoryId)`, `imports(workspaceId, createdAt)`, `commitments(workspaceId, dueOn)`. A query filtering only by `dedupeHash` or `amount` without `workspaceId` is a red flag.
- **Every query is scoped by workspace membership** (ITA §7). A row id from the URL is never sufficient; verify the caller belongs to the owning workspace in the handler, then include `workspaceId` in the WHERE clause.
- Performance budgets (BRD NFR-04): dashboard ≤ 1.5 s p95 on 4G; import ≤ 5 s p95. A report page that needs more than a couple of queries per render is wrong.

---

## 5. Clean architecture — where logic lives

```
src/core/        pure domain logic: reconcile, forecast, money — ZERO I/O
src/adapters/    StatementSource implementations (Jago, CSV) — pure, fixture-tested
src/lib/db/      schema + lazy Neon client
src/lib/session  getSession() / requireSession()
src/lib/reports/ aggregates — the only place reports touch db
src/app/**       server components (reads) + route handlers (mutations)
src/components/  shared UI — presentational, no data fetching
```

Rules:

- **`src/core/*` is pure.** No `fetch`, no `db`, no `Date.now()` passed implicitly — take time/inputs as parameters. Reconciliation math and forecast must be unit-testable without a database (ITA §4.1, §11).
- **Server components read; route handlers mutate.** No mutation in a component, no rendering in a handler.
- **Route handlers are orchestration only:** `requireSession()` → resolve workspace membership → Zod-parse the body → call core/lib → one `db.batch()` → respond. Business decisions do not belong in the handler.
- **Zod at every boundary.** Every route handler validates its body with a schema. Forms and handlers share the *same* schema object — one definition (ITA §3, Zod row).
- **Adapters hide the bank.** Nothing downstream of `Statement` (ledger, reports, forecast) may know which bank produced it. Adding a bank = new adapter module + fixtures, zero core changes (ADR-06).
- Keep the layering boring. A new folder, repository class, or abstraction layer "for later" is not allowed — YAGNI. The structure above is complete for v1.0.

---

## 6. Frontend engineering — React 16 / App Router

Rules for every UI change. The screen is the product: it must show truthfully, respond instantly, and work for a keyboard user on a cheap Android phone.

**Server vs client components**

- **Server components by default.** `"use client"` only for real interactivity (file input + pdf.js, form state, dialogs, filters that update the URL). A client component pulls its whole subtree into the bundle — keep client leaves small, not page-sized.
- Never fetch data in `useEffect` when the page is a server component — fetch on the server, pass props down. The client waterfall is the most common performance regression in this codebase.
- Client components receive **serializable props only** (no functions, no class instances across the boundary), and never receive rows the server didn't authorize — the membership check happened on the server, don't mirror it in the client.
- `proxy.ts` redirects are convenience; the UI never decides authorization. Hidden buttons are UX, not security — the handler re-checks regardless.

**State**

- Server state (ledger, totals, forecast) lives on the server. After a mutation: `revalidatePath`/`router.refresh()` — not a hand-rolled client cache of server data.
- Client state is local component state until proven otherwise. No global store library for v1.0; prop drilling two levels is fine, a context provider forest is not.
- URL is state: filters, date range, selected category on the ledger belong in search params (shareable, back-button works) — not in a `useState`.
- Forms: controlled inputs, validate with the **shared Zod schema** on submit, show field-level errors inline in Bahasa Indonesia, disable the submit button while in flight, and render the server's error verbatim — never swallow it into a toast-only message.
- Optimistic updates only where a failure is recoverable and obvious (e.g. re-categorise). Never optimistic on import, entitlement, or deletion.

**Rendering & performance** (BRD NFR-04: dashboard ≤ 1.5 s p95 on 4G)

- Ledger lists virtualize or paginate — never render 5,000 rows into the DOM because the query returned them.
- Keep client JS small: prefer server rendering + progressively enhanced forms over client-side data fetching. pdf.js loads only on the import page (dynamic import), never in the root bundle.
- Memoize only when profiling shows a problem; premature `useMemo`/`useCallback` noise is a maintenance cost, not an optimization.
- Images/static assets: next/image where applicable; `public/` only — no base64 blobs in components.

**UI conventions**

- Tailwind v4: tokens in `@theme` inside `globals.css`, **no `tailwind.config.js`** (ITA §11.7). New color/spacing values go through tokens, not hard-coded hex in components.
- shadcn components are copy-in — edit them freely in `src/components/ui`, never fork a library at runtime. Prefer extending an existing component over adding a near-duplicate.
- Icons: `lucide-react` only. No emoji as icons.
- Money and dates render via `src/core/money.ts` (`Rp 1.234.567`, `id-ID` dates) — never raw `toString()`, never `$`, never `en-US` grouping (BRD NFR-09).
- Bahasa Indonesia first for all user-facing copy; keep wording consistent with BRD examples ("Cocok dengan saldo bank", "Impor mutasi").

**States every screen must have**

Loading (skeleton, not spinner-over-blank) · empty (explain what to do next) · error (message + retry button, wired to the 503 behaviour of §8) · success. A screen that renders nothing while the DB is down violates §8 and is a bug.

**Accessibility** (BRD NFR-08, WCAG 2.2 AA — non-negotiable)

- Every input has a `<label>`; icon-only buttons have `aria-label`.
- Full keyboard path through forms, dialogs, and the ledger; visible focus rings; dialogs trap focus and close on Escape.
- Contrast ≥ 4.5:1 for text — check new status colors (green "Cocok" badge included) rather than assuming.
- Use semantic elements (`button` not `div onClick`, `table` for the ledger, correct heading order). Validation errors announced via `aria-describedby`/`aria-live`.

---

## 7. DRY — one implementation per rule

- **One reconciliation implementation.** The client calls it for the live "Cocok dengan saldo bank" gate; the server calls *the same function from `src/core/reconcile.ts`* to re-check. Duplicating the math in a route handler is the #1 way this product ships a wrong number — forbidden.
- **One forecast implementation** (`forecast(balance, committedUnpaid, remainingBudget, weddingDate, plannedMonthlyDeposit)` — BRD FR-10). Server and UI both import it.
- **One money module** (`src/core/money.ts`) for parsing/formatting rupiah. No ad-hoc `toLocaleString`, no `Math.round(amount * 100)` anywhere else.
- **One Zod schema per payload**, exported and shared. Do not re-declare a type by hand (`interface ImportBody { ... }` that mirrors a schema) — derive types with `z.infer`.
- **One dedupe implementation**: `dedupe_hash` computed in exactly one function, used by import, re-import, and manual-entry conflict checks.
- Before adding a helper, grep for an existing one. Three similar date-format or category-default snippets means merge them, don't add a fourth.
- DRY applies to *rules and facts*, not to forcing unrelated code into a shared abstraction. Two call sites of unrelated logic stay separate.

---

## 8. Errors and failure behaviour (ITA §2, BRD NFR-07)

- **Database unreachable → explicit 503 with a retry message.** Never a blank dashboard, never a swallowed error, never a zeroed-out total that looks like real data.
- **Parse failure persists nothing** and surfaces the offending line in the browser.
- **Reconciliation failure still stores the import**, but with `reconciled = false` and `issues` JSON; such imports are excluded from trusted totals until the user confirms.
- Thrown errors in handlers become a structured JSON error with an appropriate status; details go to logs, generic message to the user (auth errors especially).
- **Do not log row contents or amounts** (ITA §11.9). Log route, status, workspace id only. A single `console.log(row)` leaks a customer's finances into Workers Logs.

---

## 9. Security (non-negotiable)

- **`requireSession()` on every protected page; session resolved in every route handler before touching the DB.** `proxy.ts` only redirects — it is *not* the authorization boundary (ADR-11, CVE-2025-29927 class of bug).
- Workspace membership check on every query that reads or writes workspace data (see §4).
- Sessions: `httpOnly`, `Secure` in prod, `SameSite=Lax`; cookie carries the token only.
- Rate limits: auth 10/min/IP, import 20/hour/workspace.
- **No document, image, or avatar is ever stored or uploaded** (BRD NFR-01, ADR-08). The upload endpoint does not exist; only normalised rows are posted. Do not add file storage "just in case".
- Secrets via `wrangler secret put` / `.dev.vars` — both gitignored. Never commit `.dev.vars`, `DATABASE_URL`, or `BETTER_AUTH_SECRET`.

---

## 10. Do NOT build in v1.0 (BRD §3, ITA §1)

No OCR · no LLM anywhere in the request path · no bank API integration · no subscription/recurring billing · no multi-currency · no document/image/avatar storage · no native mobile apps · no guest list/RSVP/invitations · no vendor marketplace · no roles beyond owner/member · no KV/R2/D1/server-side session cache. If a task requires one of these, stop and raise it — scope changes go through the BRD.

---

## 11. Testing

- **New pure logic (`src/core`, adapters) ships with unit tests** — `node:test`, run with no install. Money and reconciliation tests are mandatory: formats, tampered amount, duplicate re-import (ITA §11 test strategy).
- Integration: import → persist → report against a Neon *branch*, including a duplicate re-import.
- E2e: one happy path (signup → workspace → invite → import → report) on preview. Add an e2e assertion when a bug escapes unit tests — the test that catches the class of bug, not the instance.
- UI changes: verify loading, empty, error, and keyboard-only paths manually before claiming done (§6). A11y regressions (missing label, unreachable dialog) are caught in review, not by the current toolchain.
- A fix without a failing-first test (or an explainable reason why the logic is trivial) is incomplete.
- CI gates before merge: typecheck, unit tests, schema drift check.

---

## 12. Definition of done

Backend:
- [ ] Mutation: one `db.batch()`, no `db.transaction()`, no check-then-act
- [ ] Invariant backed by a DB constraint, not just handler logic
- [ ] Every query scoped by `workspaceId` + membership verified in the handler
- [ ] No loop-around-query; aggregates done in SQL
- [ ] Body validated with the shared Zod schema; `requireSession()` present
- [ ] Pure logic in `src/core` with unit tests; no floats touching money

Frontend:
- [ ] Server component by default; `"use client"` justified and leaf-sized
- [ ] Loading / empty / error+retry / success states all present
- [ ] Labels, keyboard path, and focus visible on new interactive elements
- [ ] Money and dates go through `src/core/money.ts`; copy in Bahasa Indonesia
- [ ] No new global store, no `useEffect` data fetching on server pages

Both:
- [ ] Reused existing helper/schema/math/component before writing a new one
- [ ] No v1.0-excluded feature crept in; no logs of row contents
- [ ] Typecheck + unit tests pass; lint-clean diff
