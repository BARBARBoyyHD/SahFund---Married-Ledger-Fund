## Why

SahFund has a working auth boundary (`POST /api/auth`), a login page, Better Auth sessions in D1, and a schema that already encodes the workspace invariants — but nothing protected: there is no dashboard, no workspace, no join, no invite, and no sign-out. PEP M1's acceptance ("two accounts join one workspace") is unreachable, and every E1/E2 user story is blocked on this slice. Meanwhile the `rate_limits` table (migration 0003) sits inert while BRD NFR-02 demands fleet-wide 10/min/IP auth and 10/hour/workspace invite limits — today's limiter is a per-isolate in-memory `Map`.

## What Changes

- **Auth completion (US-01–US-04):** sign-up redirects to workspace creation, sign-in redirects to the dashboard (with a validated same-origin `next` for the join flow), a new sign-out endpoint + control clears the session cookie, a workspace-membership guard protects every new page/handler, and `src/proxy.ts` (Next 16) adds a cookie-presence convenience redirect that is explicitly never the authorization boundary. **BREAKING** (behavioural, as-built contract): `POST /api/auth` no longer returns `redirectTo: "/"`.
- **Workspace (US-05–US-08):** `POST /api/workspaces` creates the workspace + owner membership in one `db.batch()` and returns the 10-character pocket code; `POST /api/join` joins by code with constraint-violation → clear-message mapping (no member counting, no check-then-act); owner-only code rotation; member-editable wedding date and budget target (integer minor units via `src/core/money.ts`); pages `/workspaces/new`, `/join`, `/dashboard`, `/w/[workspaceId]` (shell + settings/invite surfaces).
- **Invite email (US-52, US-53):** owner sends a pocket invite through Resend using plain `fetch` (no SDK) — text-only Bahasa Indonesia, no attachments, no financial data — responding `sent` or `fallback`; on failure the screen shows the code + join link for manual copying plus a retry button (works with no `RESEND_API_KEY`); join link pre-fills the code and one confirmation joins through the same code path as manual entry.
- **Rate limiting wired to D1 (NFR-02):** `src/lib/auth/rate-limit.ts` moves to the `rate_limits` table — auth keyed `ip:` (10/min), invite keyed `ws:` (10/hour) — atomic guarded upsert, denied attempts do not increment, sweep piggybacked on writes, one implementation (the in-memory `Map` is deleted). Includes a deliberate, documented one-line extension of the P1 raw-SQL allowlist for the `count = count + 1` upsert fragment (schema.ts header + AGENTS P1).
- **Supporting:** pocket-code module in `src/core/`, shared Zod schemas per payload (client + server), typed unique-violation classification in `src/lib/db/index.ts` (P3), `src/lib/mail.ts`, and unit/integration/e2e coverage for all ten stories.
- **Not included:** `invite_tokens`/TTL (BRD FR-13 forbids a separate invite record), guest sessions, refresh tokens, import/report/ledger/forecast features, join-attempt rate limits (not in NFR-02), and any BRD/ITA/ERD/USER-STORIES edit.

## Capabilities

### New Capabilities
- `auth-session`: account creation, sign-in, sign-out, and server-side session + workspace-membership enforcement (US-01–US-04).
- `workspace-membership`: workspace creation, join by pocket code, owner-only invite-code rotation, wedding date & budget target (US-05–US-08).
- `invite-email`: pocket invite email via Resend with manual fallback, and joining from the email link (US-52, US-53).
- `rate-limiting`: D1-backed fixed-window counters implementing the NFR-02 auth (10/min/IP) and invite (10/hour/workspace) limits.

### Modified Capabilities
None — `openspec/specs/` contains no capabilities yet (this is the first change in the repo).

## Impact

- **Code (modified):** `src/app/api/auth/route.ts` (redirects, limiter wiring), `src/lib/auth/rate-limit.ts` (+ its test), `src/lib/session.ts`, `src/lib/db/index.ts` (error classification), `src/lib/db/schema.ts` (allowlist header only), root `AGENTS.md` (P1 allowlist sentence), `src/app/login/auth-form.tsx` (sign-in `next` pass-through).
- **Code (new):** `src/proxy.ts`; `src/app/dashboard/page.tsx`, `src/app/w/[workspaceId]/page.tsx` (+ settings/invite sections), `src/app/workspaces/new/page.tsx`, `src/app/join/page.tsx`; `src/app/api/auth/sign-out/route.ts`, `src/app/api/workspaces/route.ts`, `src/app/api/workspaces/[id]/rotate/route.ts`, `src/app/api/workspaces/[id]/details/route.ts`, `src/app/api/workspaces/[id]/invite/route.ts`, `src/app/api/join/route.ts`; `src/core/pocket-code.ts` (+ test); `src/lib/workspace/schema.ts` (or equivalent single module); `src/lib/mail.ts` (+ test).
- **Data:** no schema change — migrations 0000–0003 already applied; the existing `rate_limits` table becomes live. No new migration expected; if one unexpectedly surfaces, it is a database-engineering-specialist task under expand/contract rules.
- **Config/secrets:** `RESEND_API_KEY` (and a sender address) optional via `wrangler secret put` / `.dev.vars` — absence must not break deploy or the invite flow (fallback path).
- **APIs:** new mutation endpoints listed above; `POST /api/auth` response contract changes (`redirectTo` targets).
- **Tests/CI:** unit (`node:test`), integration against local D1 (`wrangler d1 migrations apply --local`), Playwright e2e; typecheck + schema-drift gates unchanged.
- **Operations:** D1 read/write volume increases on the auth path (bounded: denied attempts do not write; sweep rides writes); no cron, no KV/R2 (AGENTS §10).
- **Docs:** BRD/ITA/ERD/USER-STORIES are **not** edited here; as-built endpoint-path divergences are recorded as open questions in design.md.
