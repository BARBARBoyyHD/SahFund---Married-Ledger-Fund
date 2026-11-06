import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Gives `next dev` the Worker bindings (D1 "DB" among them) via wrangler's platform proxy.
// `DB` carries `"remote": true` in wrangler.jsonc, so `next dev` writes to the real D1.
// Playwright sets E2E_LOCAL_DB=1 so an e2e run stays on the isolated local Miniflare DB.
initOpenNextCloudflareForDev({ remoteBindings: process.env.E2E_LOCAL_DB !== "1" });

const nextConfig: NextConfig = {
  /* config options here */
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

export default nextConfig;
