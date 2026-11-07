import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * The only file with dialect-specific types (portability rule P2).
 *
 * Postgres → SQLite mapping (SPEC-d1-migration §6.1): `text` → `text()`,
 * `boolean` → `integer({ mode: 'boolean' })`, `timestamptz` →
 * `integer({ mode: 'timestamp_ms' })`, `date` → ISO `text` (`YYYY-MM-DD` sorts
 * and range-compares chronologically), `jsonb` → `text({ mode: 'json' })`,
 * `bigint` → `numeric({ mode: 'bigint' })`.
 *
 * Money: drizzle's sqlite `integer()` has no `bigint` mode (0.45.4), so money
 * uses `numeric({ mode: 'bigint' })` — binds as a string, NUMERIC affinity
 * stores it as a 64-bit INTEGER, reads back as `bigint`. Never `real`.
 * shortcut: D1 hands INTEGER back as a JS number, so money above 2^53-1
 * (~Rp 90 trillion per row) loses precision on read; `src/core/money.ts` refuses
 * to build such a value at the form boundary (SPEC §10 E4).
 *
 * The four Better Auth tables at the top are generated with
 * `npx @better-auth/cli generate` (AGENTS §2, ITA §11.6) — the CLI ran against a
 * throwaway config, since this app's module needs a Worker binding (see `auth.ts`) —
 * and pasted in; regenerate and diff on upgrade, never hand-write them. The three
 * FKs that were deferred for the auth tables (`workspaces.ownerId`,
 * `members.userId` → `user`; `transactions.memberId` → `members.userId`) landed in
 * `drizzle/0002_*` as a hand-written recreate migration — SQLite cannot ADD a
 * foreign key.
 *
 * Ids and timestamps are generated app-side (rule P6): no `now()`, no
 * `gen_random_uuid()`, no SQL-side hashing. The `sql` defaults below are the
 * constraint/default allowlist of rule P1; the one other allowlisted fragment is
 * `rateLimitIncrement` at the bottom of this file (design D4) — no other raw SQL.
 */

// --- Better Auth tables: generated, do not edit by hand ---

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// --- Domain tables ---

export const workspaces = sqliteTable("workspaces", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // UNIQUE backstop for "one workspace per user" (BRD FR-02, AGENTS §3).
  // RESTRICT: removing an account never silently deletes the workspace's rows.
  ownerId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "restrict" }),
  name: text().notNull(),
  weddingDate: text(),
  budgetTargetMinor: numeric({ mode: "bigint" }),
  inviteCode: text().notNull().unique(),
  plan: text(),
});

export const members = sqliteTable(
  "members",
  {
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    // One workspace per user: a user has at most one membership row.
    unique("members_user_unique").on(t.userId),
    // One owner + max two members: role ∈ {owner, member} caps the table at two
    // rows per workspace, so a third join fails on this index even when racing.
    unique("members_workspace_role_unique").on(t.workspaceId, t.role),
    check("members_role_check", sql`${t.role} in ('owner', 'member')`),
  ],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: text().notNull(),
    budgetMinor: numeric({ mode: "bigint" }),
    sort: integer().notNull(),
  },
  (t) => [unique("categories_workspace_name_unique").on(t.workspaceId, t.name)],
);

export const imports = sqliteTable(
  "imports",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceId: text().notNull(),
    period: text(),
    pocketName: text().notNull(),
    txCount: integer().notNull(),
    reconciled: integer({ mode: "boolean" }).notNull(),
    // Whole-row reads only — no JSON path operators (rule P6, SPEC §10 E6).
    issues: text({ mode: "json" }).notNull(),
    // US-17: a flagged import (reconciled = false) is left out of trusted totals until
    // the user confirms it; this timestamp is that confirmation. NULL = not confirmed.
    confirmedAt: integer({ mode: "timestamp_ms" }),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("imports_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Attribution target is `members.userId` (1:1 with a user under
    // UNIQUE(userId), ERD §7.4) — SET NULL so money rows survive a member leaving.
    memberId: text().references(() => members.userId, { onDelete: "set null" }),
    categoryId: text().references(() => categories.id, { onDelete: "set null" }),
    importId: text().references(() => imports.id, { onDelete: "restrict" }),
    occurredOn: text().notNull(),
    description: text().notNull(),
    // Signed; positive = money in (BRD FR-05).
    amountMinor: numeric({ mode: "bigint" }).notNull(),
    balanceMinor: numeric({ mode: "bigint" }).notNull(),
    direction: text().notNull(),
    ref: text(),
    source: text().notNull(),
    dedupeHash: text().notNull(),
  },
  (t) => [
    // Re-import is a no-op absorbed by this index, never a doubled balance.
    unique("transactions_workspace_dedupe_unique").on(t.workspaceId, t.dedupeHash),
    index("transactions_workspace_occurred_idx").on(t.workspaceId, t.occurredOn),
    index("transactions_category_idx").on(t.categoryId),
  ],
);

export const commitments = sqliteTable(
  "commitments",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    vendor: text().notNull(),
    categoryId: text().references(() => categories.id, { onDelete: "set null" }),
    totalMinor: numeric({ mode: "bigint" }).notNull(),
    paidMinor: numeric({ mode: "bigint" }).notNull(),
    dueOn: text(),
    status: text().notNull(),
  },
  (t) => [index("commitments_workspace_due_idx").on(t.workspaceId, t.dueOn)],
);

/**
 * Owner-issued read-only report links (BRD FR-11, US-32–34). Revoke sets
 * `revokedAt` and every `/r/:token` resolve checks expiry *and* the flag, so a
 * revoke takes effect on the next request without a session lookup.
 * The token is 128-bit+ app-side randomness (rule P6) — never `gen_random_uuid()`.
 */
export const shareTokens = sqliteTable(
  "share_tokens",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
    revokedAt: integer({ mode: "timestamp_ms" }),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("share_tokens_workspace_idx").on(t.workspaceId)],
);

/**
 * Payee → category rules from user corrections, applied on future imports only
 * (US-23, design decision 4) — stored rows are never rewritten by a rule change.
 * UNIQUE (workspaceId, payee) makes the set a map: accepting a second correction
 * for a known payee conflicts on the index, so the handler upserts instead.
 * SET NULL: deleting a category keeps the payee fact; the handler re-prompts.
 */
export const payeeRules = sqliteTable(
  "payee_rules",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    payee: text().notNull(),
    categoryId: text().references(() => categories.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("payee_rules_workspace_payee_unique").on(t.workspaceId, t.payee),
  ],
);

/**
 * One row per completed one-time purchase (design D1, US-37): the entitlement is
 * keyed by order id so a retried webhook or a duplicate grant is a no-op on the
 * unique index, never a second unlock. Gating is "a grant exists for this
 * workspace", and the payment mechanism stays outside this table (Appendix B-3).
 */
export const entitlementGrants = sqliteTable(
  "entitlement_grants",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // At most one grant per order — the whole idempotency guarantee (AGENTS §3).
    orderId: text().notNull(),
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    unique("entitlement_grants_order_unique").on(t.orderId),
    // The gate is a point lookup by workspace (free vs paid), one row per purchase.
    index("entitlement_grants_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * Keyed fixed-window counters (brainstorm 2026-11-05 §2.4). No FK: the key is an
 * opaque prefixed string — `ip:…`, `guest:…`, `user:…`, `ws:…` — because the table
 * must work before a session exists.
 *
 * `windowStart` is the app-computed start of the current window, so the primary
 * key *is* the window: one hit upserts (key, windowStart), the next window starts
 * a new row. `expiresAt` (= windowStart + that key's policy window) is stored
 * rather than derived because windows differ per key prefix (10/min vs 20/hour)
 * and the sweep needs one indexable column.
 *
 * No cron in v1.0: expiry is derived at read (a row with `expiresAt <= now` is
 * dead), and dead rows are swept by the write path (DELETE … WHERE expiresAt <= ?,
 * app-side timestamp — P6).
 * shortcut: the sweep rides on writes, so a key that stops being hit keeps one
 * dead row per window until the next write sweeps it — bounded by keys × windows,
 * and rows are tiny. Add a scheduled Worker only if that ever grows.
 */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: integer({ mode: "timestamp_ms" }).notNull(),
    count: integer().notNull(),
    expiresAt: integer({ mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    // The only query that is not a primary-key point lookup.
    index("rate_limits_expires_idx").on(t.expiresAt),
  ],
);

/**
 * Rule P1 allowlist entry #3: the counter bump, and the only raw-SQL expression
 * outside the defaults above. Drizzle's `onConflictDoUpdate` `set` takes a column
 * value or an expression — `count = count + 1` has no query-builder form. The
 * guard (`count < limit`) and everything else stay in the builder
 * (`src/lib/auth/rate-limit.ts`).
 */
export const rateLimitIncrement = sql`${rateLimits.count} + 1`;

export type AuthUser = typeof user.$inferSelect;
export type AuthSession = typeof session.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Commitment = typeof commitments.$inferSelect;
export type ShareToken = typeof shareTokens.$inferSelect;
export type PayeeRule = typeof payeeRules.$inferSelect;
export type EntitlementGrant = typeof entitlementGrants.$inferSelect;
