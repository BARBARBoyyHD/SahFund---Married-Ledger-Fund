/**
 * The two words the account-deletion API accepts. Kept in a DB-free module so the
 * confirm UI imports the same literals as `src/lib/deletion.ts` without pulling the
 * drizzle schema into the client bundle (AGENTS §6).
 */
export const ACCOUNT_CONFIRM = "hapus-akun";
export const ACCOUNT_WORKSPACE_PATH = "delete-with-it";
