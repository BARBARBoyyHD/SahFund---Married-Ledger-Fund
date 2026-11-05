import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth/auth";

/**
 * The authoritative session read (ADR-11). `proxy.ts` redirects are convenience only;
 * every protected page and route handler resolves the session here, server-side.
 */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/**
 * For server components. Route handlers use `getSession()` and answer 401, because a
 * redirect from an API route is a lie about what happened.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
