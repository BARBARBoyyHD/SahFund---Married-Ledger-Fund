/**
 * Test-only module hooks (AGENTS §11, task 1.5). A route handler is a plain function,
 * but its imports assume a Next request context: `@/lib/db` reaches for the Workers
 * binding and `@/lib/membership` for a session. `node:test` has neither, so this
 * loader hands the real handler the local-D1 client and a fixed member. Everything
 * else — schemas, services, `next/server`, the entitlement gate — is the real module,
 * so a test can POST to the actual route and assert its status and body.
 *
 * The test sets `globalThis.__routeDb` / `globalThis.__routeUserId` before importing
 * the route; the stubs below read them at call time.
 */
const SRC = new URL("../../src/", import.meta.url);

const STUB_DB = `data:text/javascript,${encodeURIComponent(
  "export function getDb() { return globalThis.__routeDb; }",
)}`;

const STUB_MEMBERSHIP = `data:text/javascript,${encodeURIComponent(
  "export async function membershipForApi() { return { ok: true, userId: globalThis.__routeUserId, role: 'owner' }; }",
)}`;

export async function resolve(specifier, context, nextResolve) {
  // `next/server` has no ESM subpath export entry Node can resolve on its own.
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier === "@/lib/db") return { url: STUB_DB, shortCircuit: true };
  if (specifier === "@/lib/membership") return { url: STUB_MEMBERSHIP, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    return { url: new URL(`${specifier.slice(2)}.ts`, SRC).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
