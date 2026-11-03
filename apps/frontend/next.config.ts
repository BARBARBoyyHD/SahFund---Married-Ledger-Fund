import type { NextConfig } from "next";

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
