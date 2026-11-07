import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { grantEntitlement } from "@/lib/entitlement/grant";
import { grantEntitlementSchema } from "@/lib/entitlement/schema";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";

/**
 * US-37: grant the one-time entitlement for a completed purchase. The payment
 * mechanism is undecided (Appendix B-3), so this endpoint takes an order id and a
 * workspace id and nothing else — a webhook, a license code, or a manual grant all
 * reduce to the same insert. Idempotency lives in the unique index on `orderId`
 * (AGENTS §3): a duplicate order is a no-op, never a second unlock.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = grantEntitlementSchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  // Session + membership before any write (AGENTS §9); a non-member learns nothing.
  const access = await membershipForApi(parsed.data.workspaceId);
  if (!access.ok) return access.response;

  try {
    const result = await grantEntitlement(getDb(), parsed.data);
    return NextResponse.json(
      { ok: true, alreadyGranted: result.alreadyGranted },
      { status: result.alreadyGranted ? 200 : 201 },
    );
  } catch (error) {
    // A failed insert leaves the workspace free: the purchase is never half-applied,
    // and the caller sees 503 rather than a silent success (§8).
    logFailure("POST /api/entitlements", error);
    return unavailable();
  }
}
