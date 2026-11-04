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
 * (~Rp 90 trillion per row) loses precision on read; add the write-time guard
 * at the first money endpoint (SPEC §10 E4).
 *
 * The four Better Auth tables (`user`, `session`, `account`, `verification`)
 * are deliberately absent: they are generated with `npx @better-auth/cli
 * generate` (AGENTS §2, ITA §11.6), never hand-written. `ownerId` / `userId`
 * therefore carry no FK to `user` yet — added when auth lands (0 users, so the
 * recreate migration is free).
 *
 * Ids and timestamps are generated app-side (rule P6): no `now()`, no
 * `gen_random_uuid()`, no SQL-side hashing.
 */

export const workspaces = sqliteTable("workspaces", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // UNIQUE backstop for "one workspace per user" (BRD FR-02, AGENTS §3).
  ownerId: text().notNull().unique(),
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
    userId: text().notNull(),
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
    // UNIQUE(userId), ERD §7.4); the FK lands with the auth tables.
    memberId: text(),
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

export type Workspace = typeof workspaces.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Import = typeof imports.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Commitment = typeof commitments.$inferSelect;
