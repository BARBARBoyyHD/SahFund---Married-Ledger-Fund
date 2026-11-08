/**
 * The one payment switch (design open question B-3): no gateway is chosen yet — no
 * pricing CTA, no invoice flow — so the purchase system is OFF and every workspace
 * gets free imports and export. Flipping it ON restores the gates and the grant
 * endpoint unchanged.
 *
 * Disabled by default; set `PAYMENT_ENABLED=1` (wrangler secret / `.dev.vars`) to
 * re-enable. See docs/projects/NOTE-payment-disabled.md.
 */
export function paymentEnabled(): boolean {
  return process.env.PAYMENT_ENABLED === "1";
}
