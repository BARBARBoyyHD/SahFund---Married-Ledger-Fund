import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  /* config options here */
  // Caching (Next 16 model). Static HTML and hashed assets are CDN-cached — `/` ships
  // `s-maxage=31536000`, `/_next/static/*` is `immutable`. `cacheComponents` prerenders a
  // static shell per route and `partialPrefetching` prefetches it per session, so client
  // navigations reuse that shell. Nothing user-scoped opts into `use cache`/`cacheLife`:
  // a cached dashboard would show pre-mutation money, a cached `/r/[token]` would keep a
  // revoked link alive, and the Worker has no KV/R2 cache handler by design (ITA ADR-13).
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /health is the short alias; /api/health is the documented probe path (ITA §2, PEP M1).
  async rewrites() {
    return [{ source: "/health", destination: "/api/health" }];
  },
};

export default async function config(phase: string): Promise<NextConfig> {
  // Gives `next dev` the Worker bindings (D1 "DB" among them) via wrangler's platform proxy.
  // `DB` carries `"remote": true` in wrangler.jsonc, so `next dev` writes to the real D1.
  // Playwright sets E2E_LOCAL_DB=1 so an e2e run stays on the isolated local Miniflare DB.
  //
  // Dev only. The init starts Miniflare/workerd, and `next build` evaluates this config in every
  // build worker process, so an unconditional call spawns several workerd instances that race on
  // `.wrangler/state/**/*.sqlite` ("database is locked: SQLITE_BUSY" on Workers Builds) and ask for
  // a remote D1 token in CI. The build reads no binding, so the whole call is gated, not just the await.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // Awaiting matters: unawaited, `next dev` serves requests before the context exists and every one
    // throws "getCloudflareContext has been called without initOpenNextCloudflareForDev" (auth.ts:24).
    await initOpenNextCloudflareForDev({ remoteBindings: process.env.E2E_LOCAL_DB !== "1" });
  }
  return nextConfig;
}
