import { lte, lt } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { rateLimitIncrement, rateLimits } from "../db/schema.ts";

/** NFR-02 windows. The key prefix picks the policy: `ip:` auth 10/min, `ws:` invite 10/hour, `imp:` import 20/hour. */
export type Limit = { limit: number; windowMs: number };

export const AUTH_LIMIT: Limit = { limit: 10, windowMs: 60_000 };
export const INVITE_LIMIT: Limit = { limit: 10, windowMs: 3_600_000 };
export const IMPORT_LIMIT: Limit = { limit: 20, windowMs: 3_600_000 };

/** The two NFR-02 windows as the user reads them. */
const RETRY_IN: Record<number, string> = { 60_000: "satu menit", 3_600_000: "satu jam" };

/**
 * US-45: the one 429 sentence — what was exceeded and when to retry. Pure, so both
 * handlers and the unit suite read the same copy (AGENTS §7).
 */
export function rateLimitMessage(what: string, windowMs: number) {
  const retry = RETRY_IN[windowMs] ?? `${Math.ceil(windowMs / 60_000)} menit`;
  return `Terlalu banyak ${what}. Tunggu ${retry} lalu coba lagi.`;
}

/** Caller identity for the auth limit: the edge-supplied client IP, never a header we trust blindly. */
export function clientKey(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || "unknown";
}

/** Fixed window bounds, computed app-side (rule P6 — no SQL `now()`), aligned to the epoch. */
export function windowFor(now: number, windowMs: number) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return { windowStart, expiresAt: windowStart + windowMs };
}

/**
 * NFR-02: the one fleet-wide fixed-window limiter, backed by `rate_limits` (design D3).
 *
 * One atomic upsert per attempt: the `count < limit` guard means an over-limit attempt
 * updates no row (empty `returning`) and therefore writes nothing. Expired rows are
 * swept in the same `db.batch()` as the increment — no cron, no second round trip.
 *
 * Fails open with a warning that carries no key and no row: a dead D1 already turns
 * into the handler's explicit 503, so blocking sign-in here adds no security.
 */
export async function allowAttempt(
  db: Db,
  key: string,
  limit: Limit,
  now = Date.now(),
): Promise<boolean> {
  const { windowStart, expiresAt } = windowFor(now, limit.windowMs);

  try {
    const [, allowed] = await db.batch([
      db.delete(rateLimits).where(lte(rateLimits.expiresAt, new Date(now))),
      db
        .insert(rateLimits)
        .values({
          key,
          windowStart: new Date(windowStart),
          count: 1,
          expiresAt: new Date(expiresAt),
        })
        .onConflictDoUpdate({
          target: [rateLimits.key, rateLimits.windowStart],
          set: { count: rateLimitIncrement },
          setWhere: lt(rateLimits.count, limit.limit),
        })
        .returning({ count: rateLimits.count }),
    ]);

    return allowed.length > 0;
  } catch (error) {
    console.warn("[rate-limit] counter unavailable, failing open", {
      keyPrefix: key.split(":")[0],
      cause: error instanceof Error ? error.name : typeof error,
    });
    return true;
  }
}
