import { and, eq } from "drizzle-orm";

import { classifyError, type Db } from "../db/index.ts";
import { categories } from "../db/schema.ts";
import type { UpdateCategoryData } from "./schema.ts";

export type UpdateCategoryResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "duplicate-name" };

/**
 * US-22/US-26: rename and/or set the budget of one category. The UPDATE is workspace-
 * scoped, so a foreign id is a 404 rather than another couple's row. A duplicate name is
 * refused by `UNIQUE(workspaceId, name)`; this function only classifies the violation
 * (rule P3) and the handler picks the message — no read-then-write (AGENTS §3).
 */
export async function updateCategory(
  db: Db,
  workspaceId: string,
  categoryId: string,
  data: UpdateCategoryData,
): Promise<UpdateCategoryResult> {
  const changes: { name?: string; budgetMinor?: bigint | null } = {};
  if (data.name !== undefined) changes.name = data.name;
  if (data.budgetMinor !== undefined) {
    changes.budgetMinor = data.budgetMinor === null ? null : BigInt(data.budgetMinor);
  }
  if (Object.keys(changes).length === 0) return { ok: true };

  try {
    const rows = await db
      .update(categories)
      .set(changes)
      .where(and(eq(categories.id, categoryId), eq(categories.workspaceId, workspaceId)))
      .returning({ id: categories.id });

    return rows.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  } catch (error) {
    const violation = classifyError(error);
    if (violation?.table === "categories" && violation.columns.includes("name")) {
      return { ok: false, reason: "duplicate-name" };
    }
    throw error;
  }
}
