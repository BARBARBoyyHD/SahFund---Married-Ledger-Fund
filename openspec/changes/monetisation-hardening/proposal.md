## Why

E9 (Entitlement & Purchase), E10 (Deletion & Privacy), the remaining E11 story (US-45), and all of E12 are untouched — 12 outstanding stories. Without them the product has no revenue path (FR-12 one-time purchase), no deletion rights (NFR-06, Indonesian PDP law), no import rate limit (NFR-02), and no verified a11y/i18n/performance bar (NFR-03/04/07/08/09) — PEP M4's exit ("a stranger can pay and get access with no manual step") plus the quality gate for M5.

## What Changes

- **Free tier & pricing** (US-35, US-36 — *cut candidate #2*): first import free with full dashboard; second import and export locked with a clear unlock message (never silent failure, imported data stays visible); pricing page stating Rp 49.000 intro / Rp 99.000 list charged once per wedding, no recurring language, with the privacy position alongside.
- **Purchase & unlock** (US-37): one-time entitlement grants unlimited imports + export for that workspace; grant idempotent per order (webhook retry safe); in-flight/failed payment leaves state unchanged — no partial unlock, error shown not swallowed.
- **Export** (US-38): paid workspaces export their rows machine-readably, membership-verified server-side, workspace-scoped only; free workspaces see the US-35 lock message.
- **Deletion** (US-39, US-40): owner-only workspace deletion cascading all rows immediately (no queryable orphans); account deletion removes user + sessions with an explicit, stated path for an owned workspace; ≤ 30-day backup purge (NFR-06).
- **Privacy guarantees** (US-41, US-42): zero file bytes anywhere, no upload endpoints, no object storage; logs carry route/status/workspace id only — never amounts or row contents.
- **Rate-limit feedback** (US-45): import limit 20/hour/workspace added to the shared limiter; explicit Bahasa Indonesia message stating the limit and retry timing for auth (10/min/IP) and import — never a dead button or unexplained 500.
- **Quality bar** (US-47–51): exact integer-minor-unit money with Rp 1 / Rp 0.05 reconciliation tolerances, `Rp 1.234.567` + id-ID everywhere via the shared modules, WCAG 2.2 AA across all screens, loading/empty/error+retry/success on every screen, ≤ 5 s import / ≤ 1.5 s dashboard p95 with pdf.js only on the import page.

## Capabilities

### New Capabilities
- `entitlement`: free-tier limits and lock messaging, one-time price presentation, idempotent purchase grant, paid-only export.
- `deletion-privacy`: workspace/account deletion semantics, no-storage guarantee, log redaction rules.
- `quality-standards`: money exactness, Bahasa Indonesia/id-ID formatting, WCAG 2.2 AA, four-state screens, 4G performance budgets.

### Modified Capabilities
- `rate-limiting`: add the import limit (20/hour/workspace) to the shared counter scheme and require explicit Bahasa Indonesia limit + retry-timing feedback on rejection (US-45).

## Impact

- Code: pricing page (`src/components/landing/pricing.tsx` exists — verify copy), entitlement grant handler/webhook (idempotent per order), export route handler, delete-workspace/delete-account handlers, `src/lib/db/index.ts` error classification, rate-limit counters (`rate_limits` table, import key), audit pass across all screens for US-47–51.
- Constraints: AGENTS.md §2 (`db.batch()` cascade writes), §3 (idempotency keyed by order id), §8 (503 + retry on DB down, no row contents in logs), §9 (rate limits, no file storage), §10 (no subscriptions/billing beyond one-time), P5/P6.
- Sources: BRD FR-12, NFR-02, NFR-03, NFR-04, NFR-06, NFR-07, NFR-08, NFR-09; ITA §6, §7, §11.9, ADR-08; USER-STORIES US-35–42, US-45, US-47–51.
- Open: purchase mechanism undecided (Appendix B-3: license code or Lynk.id order) — spec keeps the grant mechanism-agnostic.
