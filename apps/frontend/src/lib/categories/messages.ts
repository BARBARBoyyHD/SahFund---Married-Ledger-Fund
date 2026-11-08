/**
 * Category copy in Bahasa Indonesia (AGENTS §6), rendered verbatim by the UI. A
 * duplicate name is refused by `UNIQUE(workspaceId, name)` — the handler only picks
 * this message from the classified violation, it never pre-checks (AGENTS §3).
 */
export const CATEGORY_MESSAGE = {
  duplicateName: "Nama kategori sudah dipakai di workspace ini. Pilih nama lain.",
  notFound: "Kategori tidak ditemukan.",
} as const;
