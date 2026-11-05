import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Gives `next dev` the Worker bindings (D1 "DB" among them) via wrangler's platform proxy.
initOpenNextCloudflareForDev();

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
