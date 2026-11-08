# RUNBOOK — Backup purge (NFR-06, ≤ 30 days)

Operational procedure behind `BRD §5 NFR-06` and `ITA §5` (retention): a deleted workspace
or account must be gone from every copy within **30 days**. Deletion itself is immediate
(one atomic `db.batch()` — `US-39`/`US-40`); this page covers the copies nobody queries.

**Who runs it:** the maintainer on the Cloudflare account (Uwi). **When:** at every release
that ships deletion changes, and once a quarter — record the date and result in
`PEP` M5 notes. **Time:** ~5 minutes.

## Why there is nothing to delete (by default)

D1 has no scheduled backups and no backup bucket. Its only historical copy is
**Time Travel**, which is always on and keeps a bookmark window of **30 days on Workers
Paid, 7 days on Workers Free** (`developers.cloudflare.com/d1/reference/time-travel`).
Bookmarks older than the window are invalid and cannot be restored — so the default
configuration already meets NFR-06: deleted rows age out ≤ 30 days, no action needed.

Two things would break that, and both are avoided:

1. **Exporting D1 to R2 or anywhere else** for long-term retention. Do not schedule it.
   If a migration or incident needs a one-off export (`wrangler d1 export`), the file is a
   copy of customer data: delete it (local file and any bucket object) within 24 hours and
   never later than 30 days after the deletion it predates.
2. **A Free-plan database bound to a Paid-only expectation** is not a risk (7 < 30), but
   confirm the plan so the window is a known 30 days, not an unknown longer one.

## Procedure

1. `wrangler d1 info sahfunddb` — confirm `version: production` (Time Travel supported)
   and note the plan's window (Paid = 30 days, Free = 7).
2. `wrangler d1 time-travel info sahfunddb` — the current bookmark proves Time Travel is
   live; note the timestamp.
3. Check `wrangler.jsonc` has no `r2_buckets`, `kv_namespaces` or `d1_databases[].backup`
   entries, and the Cloudflare dashboard shows no R2 bucket holding D1 exports.
4. If any ad-hoc export exists, delete it now and note the date.

## Verification (≥ 30 days after a deletion)

1. `wrangler d1 time-travel info sahfunddb --timestamp="<deletion time, RFC3339>"` —
   expected: an error that the bookmark is older than the window. That error **is** the
   proof the copy has aged out.
2. Spot-check the live DB: the deleted workspace/account ids return no rows
   (`wrangler d1 execute sahfunddb --remote --command "select count(*) from workspaces where id = '<id>'"`).
3. Record date, command output and outcome in the release notes / `PEP` M5.

If step 1 ever returns a valid bookmark for a timestamp > 30 days old, stop: the retention
window is longer than NFR-06 allows — raise it with Cloudflare support and suspend
deletion-facing releases until resolved.
