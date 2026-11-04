const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const MAX_KEYS = 10_000;

const attempts = new Map<string, number[]>();

/** Caller identity for the auth limit: the edge-supplied client IP, never a header we trust blindly. */
export function clientKey(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip || "unknown";
}

/**
 * NFR-02: at most 10 auth attempts per minute per IP. Fixed window is enough — an
 * attacker gains nothing from the boundary skew.
 *
 * shortcut: the counter lives in this isolate's memory, so the fleet-wide limit is
 * 10/min/IP *per isolate*. Move it to a shared counter if abuse ever justifies it.
 */
export function allowAuthAttempt(key: string, now = Date.now()) {
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return false;
  }

  recent.push(now);
  attempts.set(key, recent);
  // Unbounded client IPs must not grow the map without a ceiling.
  if (attempts.size > MAX_KEYS) attempts.clear();
  return true;
}
