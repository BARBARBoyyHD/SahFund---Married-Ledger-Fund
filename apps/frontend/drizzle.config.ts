import { defineConfig } from "drizzle-kit";

// sqlite dialect (ITA ADR-13). `generate` is offline — no credentials needed;
// the SQL it emits is committed and applied with
// `wrangler d1 migrations apply DB --local|--remote` (AGENTS §2).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
