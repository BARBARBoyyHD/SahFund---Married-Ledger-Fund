import { and, count, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { z } from "zod";

import { toMinor } from "../../core/dashboard.ts";
import type { Db } from "../db/index.ts";
import { categories, transactions, user } from "../db/schema.ts";

/**
 * US-18/US-19: the ledger read. Filter state lives in URL search params (design
 * decision 1), filtering, ordering and pagination happen in SQL (AGENTS §4), and every
 * query is scoped by `workspaceId` — the handler/page already proved membership.
 *
 * URL keys: `dateFrom`, `dateTo`, `categoryId` (comma-separated ids), `memberId`,
 * `direction` (`in`/`out`), `keyword`, `page`.
 */

/** A search param as the page receives it; empty/blank means "no filter". */
const asParam = (value: unknown): string | undefined => {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === "string" && single.trim() !== "" ? single.trim() : undefined;
};

const dateParam = z.preprocess(asParam, z.iso.date().optional());
const idParam = z.preprocess(asParam, z.string().max(64).optional());
const directionParam = z.preprocess(asParam, z.enum(["in", "out"]).optional());
const keywordParam = z.preprocess(asParam, z.string().max(100).optional());
const categoryParam = z.preprocess((value) => {
  const single = asParam(value);
  return single === undefined ? [] : single.split(",").map((id) => id.trim()).filter(Boolean);
}, z.array(z.string().max(64)).max(50));

export const ledgerFilterSchema = z.object({
  dateFrom: dateParam,
  dateTo: dateParam,
  /** One or many category ids; `[]` = no category filter. */
  categoryId: categoryParam,
  memberId: idParam,
  direction: directionParam,
  keyword: keywordParam,
});

export type LedgerFilter = z.output<typeof ledgerFilterSchema>;

/** `?page=` with a safe fallback; page 1 when absent or nonsense. */
const pageParam = z.preprocess(
  (value) => asParam(value) ?? "1",
  z.coerce.number().int().min(1).catch(1),
);

/** The page's one call: parsed filters plus the page number, both safe on a hand-edited URL. */
export function parseLedgerQuery(searchParams: Record<string, string | string[] | undefined>) {
  const parsed = ledgerFilterSchema.safeParse(searchParams);
  return {
    filters: parsed.success ? parsed.data : ledgerFilterSchema.parse({}),
    page: pageParam.parse(searchParams.page),
  };
}

export const LEDGER_PAGE_SIZE = 50;

export type LedgerRow = {
  id: string;
  occurredOn: string;
  description: string;
  /** Signed minor units, positive = money in. */
  amountMinor: number;
  direction: string;
  categoryId: string | null;
  categoryName: string | null;
  memberId: string | null;
  memberName: string | null;
  /** Imported rows are only classification-editable; manual rows are fully editable. */
  imported: boolean;
};

export type LedgerPage = {
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export async function listTransactions(
  db: Db,
  workspaceId: string,
  filters: LedgerFilter,
  page: number = 1,
): Promise<LedgerPage> {
  const pageNumber = Math.max(1, Math.trunc(page));

  // Every filter is a WHERE condition — the client never receives rows it did not ask for.
  // shortcut: `%` and `_` typed in the keyword still act as LIKE wildcards; escape them
  // if the search box ever needs literal matching.
  const where = and(
    eq(transactions.workspaceId, workspaceId),
    filters.dateFrom ? gte(transactions.occurredOn, filters.dateFrom) : undefined,
    filters.dateTo ? lte(transactions.occurredOn, filters.dateTo) : undefined,
    filters.categoryId.length > 0 ? inArray(transactions.categoryId, filters.categoryId) : undefined,
    filters.memberId ? eq(transactions.memberId, filters.memberId) : undefined,
    filters.direction ? eq(transactions.direction, filters.direction) : undefined,
    filters.keyword ? like(transactions.description, `%${filters.keyword}%`) : undefined,
  );

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        occurredOn: transactions.occurredOn,
        description: transactions.description,
        amountMinor: transactions.amountMinor,
        direction: transactions.direction,
        categoryId: transactions.categoryId,
        memberId: transactions.memberId,
        importId: transactions.importId,
      })
      .from(transactions)
      .where(where)
      // Newest first; the id tiebreak keeps offsets stable for same-day rows.
      .orderBy(desc(transactions.occurredOn), desc(transactions.id))
      .limit(LEDGER_PAGE_SIZE)
      .offset((pageNumber - 1) * LEDGER_PAGE_SIZE),
    db.select({ total: count() }).from(transactions).where(where),
  ]);

  const categoryIds = [
    ...new Set(rows.map((row) => row.categoryId).filter((id): id is string => id !== null)),
  ];
  const memberIds = [
    ...new Set(rows.map((row) => row.memberId).filter((id): id is string => id !== null)),
  ];

  // One `inArray` per reference table + a Map — never a lookup per row (AGENTS §4).
  const [categoryRows, memberRows] = await Promise.all([
    categoryIds.length === 0
      ? []
      : db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(
            and(eq(categories.workspaceId, workspaceId), inArray(categories.id, categoryIds)),
          ),
    memberIds.length === 0
      ? []
      : db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, memberIds)),
  ]);

  const categoryNames = new Map(categoryRows.map((row) => [row.id, row.name]));
  const memberNames = new Map(memberRows.map((row) => [row.id, row.name]));
  const total = Number(totalRows[0]?.total ?? 0);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      occurredOn: row.occurredOn,
      description: row.description,
      amountMinor: toMinor(row.amountMinor),
      direction: row.direction,
      categoryId: row.categoryId,
      categoryName: row.categoryId === null ? null : (categoryNames.get(row.categoryId) ?? null),
      memberId: row.memberId,
      memberName: row.memberId === null ? null : (memberNames.get(row.memberId) ?? null),
      imported: row.importId !== null,
    })),
    total,
    page: pageNumber,
    pageSize: LEDGER_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE)),
  };
}
