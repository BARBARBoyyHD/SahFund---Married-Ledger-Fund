# NOTE — Payment disabled (temporary, B-3)

**Status:** payment temporarily OFF. **Why:** the purchase mechanism is still undecided
(OpenSpec `monetisation-hardening` design, Appendix B-3: license code vs Lynk.id order) —
there is no pricing CTA and no invoice flow yet. The product owner's decision: turn the
purchase system off and unlock everything so the import → export flow can be tested.

Tracked against **B-3**; this is temporary and will be re-enabled once a gateway is chosen.

## One switch

`PAYMENT_ENABLED` — read by `paymentEnabled()` in
`apps/frontend/src/lib/entitlement/payment.ts`.

- **Default (unset / anything but `1`): payment disabled.**
- `PAYMENT_ENABLED=1`: the full entitlement behaviour from `monetisation-hardening`
  (first import free, later imports and export need a grant).

`payment.ts` is the only place the env var is read; the gates and the grant endpoint
call that one function.

## What is disabled while the switch is off

- **Entitlement enforcement.** `importGate` and `exportGate` both return `{ ok: true }`
  without touching the database. The gate logic itself is untouched — it just returns
  early until the switch is on.
- **Grant endpoint.** `POST /api/entitlements` answers `503`
  `{ "message": "Pembelian belum tersedia untuk sementara." }` before parsing the body:
  nothing is granted, nothing is written.
- **Pricing section on the landing page.** The `<Pricing />` block (and its import) in
  `apps/frontend/src/app/page.tsx` is commented out with a `TODO(payment)` pointer to
  this note. The component file is unchanged and comes back as-is.

## What still works

Unlimited imports **and** export for every workspace — including workspaces that never
paid and workspaces that never bought anything. This is the point of the temporary mode:
the export path is exercised end to end.

## How to re-enable

1. Set `PAYMENT_ENABLED=1` — `wrangler secret put PAYMENT_ENABLED` for the deployed
   Worker (or a `vars` entry in `wrangler.jsonc`), `.dev.vars` for local dev.
   Never commit the secret.
2. Uncomment the `Pricing` import and `<Pricing />` in `apps/frontend/src/app/page.tsx`.
3. Implement/verify the payment UI and invoice flow for the chosen mechanism (B-3), and
   wire the provider's webhook to `POST /api/entitlements` — the grant is idempotent per
   order id, so retries are safe.
4. Run the suite: `npm test` and `npm run test:integration`. The integration tests set
   `PAYMENT_ENABLED=1` themselves and exercise the ON path (403 on a second import, export
   refused without a grant, idempotent grant).
5. Confirm the landing page shows the pricing block again and the export button returns a
   file for a paid workspace only.
