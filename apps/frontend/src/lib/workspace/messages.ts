/**
 * The user-facing copy for every workspace/invite failure, in Bahasa Indonesia and
 * rendered verbatim by the UI (AGENTS §6). One place, so the same failure never reads
 * two ways — and so the strings the frontend codes against are all here.
 */
export const WORKSPACE_MESSAGE = {
  /** US-05: a second workspace is refused by the database. */
  alreadyMember: "Akun ini sudah tergabung di sebuah workspace. Satu akun hanya untuk satu workspace.",
  /** US-06: the caller re-submitted their own workspace's code. */
  alreadyHere: "Anda sudah menjadi anggota workspace ini.",
  /** US-06/US-53: the caller belongs to a different workspace. */
  alreadyElsewhere: "Akun ini sudah tergabung di workspace lain. Satu akun hanya untuk satu workspace.",
  /** US-06: both membership slots are taken (UNIQUE(workspaceId, role)). */
  full: "Workspace ini sudah penuh. Maksimal dua anggota per workspace.",
  /** US-06/US-53: unknown or rotated code — never an error dump. */
  invalidCode: "Kode undangan tidak valid.",
  /** US-07/US-52: rotation and invite sending are owner-only. */
  ownerOnly: "Hanya pemilik workspace yang bisa melakukan ini.",
} as const;
