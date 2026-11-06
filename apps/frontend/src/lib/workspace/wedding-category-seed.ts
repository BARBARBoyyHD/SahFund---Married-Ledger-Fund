/**
 * BRD FR-06: the seeded Indonesian wedding set, in display order. One constant so the
 * create batch, the backfill script and their tests cannot drift apart. `sort` is 1..10
 * (the `categories.sort` column), ids are generated app-side (rule P6).
 *
 * `kind` is NOT NULL but its values are not enumerated anywhere in ERD/ITA/BRD; every
 * seeded category is a spending bucket for the wedding, so `"expense"` is stored.
 */
export const CATEGORY_KIND = "expense";

export const SEED_CATEGORY_NAMES = [
  "Catering",
  "Venue",
  "Dekorasi",
  "Busana & Rias",
  "Dokumentasi",
  "Undangan & Souvenir",
  "Seserahan & Mahar",
  "Adat & Prosesi",
  "Transportasi",
  "Lain-lain",
] as const;

export function missingCategoryRows(workspaceId: string, existingNames: readonly string[]) {
  const present = new Set(existingNames);
  return SEED_CATEGORY_NAMES.flatMap((name, index) =>
    present.has(name)
      ? []
      : [
          {
            id: crypto.randomUUID(),
            workspaceId,
            name,
            kind: CATEGORY_KIND,
            sort: index + 1,
          },
        ],
  );
}

/** Every seed row for a brand-new workspace (no names exist yet). */
export function seedCategoryRows(workspaceId: string) {
  return missingCategoryRows(workspaceId, []);
}
