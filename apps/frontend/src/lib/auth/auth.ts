import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

declare global {
  interface CloudflareEnv {
    /** `openssl rand -base64 32` in `.dev.vars` (local) / `wrangler secret put` (prod). */
    BETTER_AUTH_SECRET?: string;
    /** Public origin, e.g. `http://localhost:3141`. Optional: inferred from the request. */
    BETTER_AUTH_URL?: string;
  }
}

/**
 * One auth instance per isolate, created on first use so the D1 binding is read at
 * request time — same reason `getDb()` is lazy (ITA §2). The schema CLI never runs
 * this module (it has no Worker binding); the tables in `db/schema.ts` were generated
 * from a throwaway config with the same options.
 */
function createAuth() {
  const { env } = getCloudflareContext();
  const secret = env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  // Fail loudly in the log, never to the user: a missing secret is a deploy mistake.
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const baseURL = env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL;

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    secret,
    baseURL,
    trustedOrigins: baseURL ? [baseURL] : undefined,
    // v1.0: email + password only. No OAuth, no email verification (BRD FR-01).
    emailAndPassword: {
      enabled: true,
      // Mirrors the shared Zod rule (src/lib/auth/schema.ts); defence in depth.
      minPasswordLength: 10,
      requireEmailVerification: false,
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!auth) auth = createAuth();
  return auth;
}
