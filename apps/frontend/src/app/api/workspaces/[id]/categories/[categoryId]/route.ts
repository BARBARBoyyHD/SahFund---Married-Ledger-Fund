import { NextResponse } from "next/server";

import { CATEGORY_MESSAGE } from "@/lib/categories/messages";
import { updateCategorySchema } from "@/lib/categories/schema";
import { updateCategory } from "@/lib/categories/update-category";
import { getDb } from "@/lib/db";
import { invalid, logFailure, unavailable } from "@/lib/http";
import { membershipForApi } from "@/lib/membership";

/**
 * US-22/US-26: rename a category and/or set its budget (rupiah text → minor units by the
 * shared schema). Both members share the budget, so there is no owner check. The unique
 * index on `(workspaceId, name)` is the source of truth for duplicate names — this
 * handler only maps that violation to a clear 409 (AGENTS §3).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> },
) {
  const { id, categoryId } = await params;

  const access = await membershipForApi(id);
  if (!access.ok) return access.response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(body ?? {});
  if (!parsed.success) return invalid(parsed.error);

  try {
    const result = await updateCategory(getDb(), id, categoryId, parsed.data);

    if (result.ok) return NextResponse.json({ ok: true });
    if (result.reason === "duplicate-name") {
      return NextResponse.json({ message: CATEGORY_MESSAGE.duplicateName }, { status: 409 });
    }
    return NextResponse.json({ message: CATEGORY_MESSAGE.notFound }, { status: 404 });
  } catch (error) {
    logFailure("PATCH /api/workspaces/[id]/categories/[categoryId]", error);
    return unavailable();
  }
}
