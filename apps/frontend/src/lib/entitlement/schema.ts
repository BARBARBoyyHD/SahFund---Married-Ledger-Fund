import { z } from "zod";

/**
 * US-37: one shared body schema for the grant handler. The payment mechanism is
 * undecided (Appendix B-3), so the payload is deliberately mechanism-agnostic —
 * a completed purchase is identified by its order id, nothing else.
 */
export const grantEntitlementSchema = z.object({
  workspaceId: z
    .string({ error: "Workspace tidak valid." })
    .trim()
    .min(1, "Workspace tidak valid.")
    .max(64, "Workspace tidak valid."),
  orderId: z
    .string({ error: "ID pesanan wajib diisi." })
    .trim()
    .min(1, "ID pesanan wajib diisi.")
    .max(128, "ID pesanan terlalu panjang."),
});

export type GrantEntitlementData = z.output<typeof grantEntitlementSchema>;
