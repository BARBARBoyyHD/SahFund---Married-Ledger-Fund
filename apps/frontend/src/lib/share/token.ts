/**
 * BRD FR-11 / US-32–34: the read-only share token. 128 bits of app-side randomness
 * (rule P6 — D1 has no `gen_random_uuid()`), URL-safe hex, stored UNIQUE and resolved on
 * every `/r/:token` read. Never log a token (AGENTS §8/ITA §11.9).
 */

/** Design decision 5: conservative default, the owner can always create another. */
export const SHARE_TOKEN_TTL_DAYS = 30;

const TOKEN_BYTES = 16;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function shareTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + SHARE_TOKEN_TTL_DAYS * MS_PER_DAY);
}

/** Revoked wins over expired: both answer "link tidak tersedia" (spec: revoked = expired). */
export type ShareTokenState = "active" | "expired" | "revoked";

export function shareTokenState(
  token: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): ShareTokenState {
  if (token.revokedAt !== null) return "revoked";
  return token.expiresAt.getTime() <= now.getTime() ? "expired" : "active";
}
