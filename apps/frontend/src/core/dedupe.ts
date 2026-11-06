import { createHash } from "node:crypto";

/**
 * The one dedupe implementation (AGENTS §3/§7). The tuple is pinned by ERD §5 and
 * ITA §5: `sha256(workspaceId | date | time | amountMinor | balanceMinor | ref)`.
 *
 * Pure and deterministic: the same components always produce the same 64-char hex,
 * which is what lets `UNIQUE (workspaceId, dedupeHash)` absorb a re-import or refuse a
 * duplicate manual row. The hash is computed app-side because SQLite/D1 has no sha256()
 * (rule P6). Import, re-import and manual entry all call this function.
 */
export type DedupeInput = {
  workspaceId: string;
  /** `YYYY-MM-DD`, the stored `occurredOn` text. */
  date: string;
  /** `HH:mm` from the statement; empty for manual rows. */
  time: string;
  /** Signed minor units (positive = money in). */
  amountMinor: number;
  /** Printed running balance; 0 for manual rows (not applicable). */
  balanceMinor: number;
  /** Bank reference; empty for manual rows. */
  ref: string;
};

export function dedupeHash({
  workspaceId,
  date,
  time,
  amountMinor,
  balanceMinor,
  ref,
}: DedupeInput): string {
  return createHash("sha256")
    .update(
      [workspaceId, date, time, String(amountMinor), String(balanceMinor), ref].join("|"),
    )
    .digest("hex");
}
