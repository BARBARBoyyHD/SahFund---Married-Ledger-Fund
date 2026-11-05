import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { startD1 } from "../helpers/d1.ts";
import * as schema from "../../src/lib/db/schema.ts";
import { AUTH_LIMIT, INVITE_LIMIT, allowAttempt } from "../../src/lib/auth/rate-limit.ts";

const { rateLimits } = schema;

/**
 * The limiter against real SQLite (NFR-02, rate-limiting spec scenarios). The counter
 * is a table, not a variable: two Drizzle clients over one binding stand in for two
 * isolates reading the same window.
 */

let h: Awaited<ReturnType<typeof startD1>>;

before(async () => {
  h = await startD1();
});

after(async () => {
  await h.dispose();
});

/** A second client on the same D1 binding — the "other isolate". */
const otherIsolate = () =>
  drizzle(h.binding as Parameters<typeof drizzle>[0], { schema });

const NOW = 1_800_000_000_000; // aligned to a minute and an hour

const rowFor = (key: string) =>
  h.db.select().from(rateLimits).where(eq(rateLimits.key, key));

it("allows ten auth attempts a minute and refuses the eleventh without writing", async () => {
  const key = "ip:203.0.113.10";

  for (let i = 0; i < 10; i++) {
    assert.equal(await allowAttempt(h.db, key, AUTH_LIMIT, NOW), true, `attempt ${i + 1}`);
  }

  assert.equal(await allowAttempt(h.db, key, AUTH_LIMIT, NOW), false);
  assert.equal(await allowAttempt(h.db, key, AUTH_LIMIT, NOW), false);

  const rows = await rowFor(key);
  assert.equal(rows.length, 1, "one row per (key, window)");
  assert.equal(rows[0].count, 10, "denied attempts never increment the counter");
});

it("the counter is the table, so it survives an isolate swap", async () => {
  const key = "ip:198.51.100.20";
  for (let i = 0; i < 6; i++) await allowAttempt(h.db, key, AUTH_LIMIT, NOW);

  // A different client (different isolate) sees the same window and adds to it.
  const other = otherIsolate();
  for (let i = 0; i < 4; i++) assert.equal(await allowAttempt(other, key, AUTH_LIMIT, NOW), true);
  assert.equal(await allowAttempt(other, key, AUTH_LIMIT, NOW), false);

  const [row] = await rowFor(key);
  assert.equal(row.count, 10);
});

it("the next window starts a new row and is allowed again", async () => {
  const key = "ip:192.0.2.30";
  for (let i = 0; i < 10; i++) await allowAttempt(h.db, key, AUTH_LIMIT, NOW);
  assert.equal(await allowAttempt(h.db, key, AUTH_LIMIT, NOW), false);

  assert.equal(await allowAttempt(h.db, key, AUTH_LIMIT, NOW + 60_000), true);

  const rows = await rowFor(key);
  assert.equal(rows.length, 1, "the new window is a new row; the expired one is swept by the write");
  assert.equal(rows[0].windowStart.getTime(), NOW + 60_000);
});

it("keys are independent, and invite windows are hourly and per workspace", async () => {
  const a = "ws:ws-a";
  const b = "ws:ws-b";

  for (let i = 0; i < 10; i++) assert.equal(await allowAttempt(h.db, a, INVITE_LIMIT, NOW), true);
  assert.equal(await allowAttempt(h.db, a, INVITE_LIMIT, NOW), false);

  // A different workspace has its own budget.
  assert.equal(await allowAttempt(h.db, b, INVITE_LIMIT, NOW), true);
  // And the hour has not rolled yet, while a minute has.
  assert.equal(await allowAttempt(h.db, a, INVITE_LIMIT, NOW + 60_000), false);
  assert.equal(await allowAttempt(h.db, a, INVITE_LIMIT, NOW + 3_600_000), true);
});

it("sweeps expired windows on the write path, so storage stays bounded", async () => {
  const stale = "ip:203.0.113.99";
  await h.db.insert(rateLimits).values({
    key: stale,
    windowStart: new Date(NOW - 60_000),
    count: 1,
    expiresAt: new Date(NOW),
  });

  // Any allowed attempt rides the sweep.
  assert.equal(await allowAttempt(h.db, "ip:203.0.113.98", AUTH_LIMIT, NOW), true);
  assert.deepEqual(await rowFor(stale), [], "the expired row is gone");
  assert.equal((await rowFor("ip:203.0.113.98")).length, 1, "the live row survives");
});
