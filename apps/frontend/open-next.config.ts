import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// v1.0 has no ISR and no R2/KV (AGENTS §10), so prerendered pages are read from
// the build output — the adapter's documented "static site" setup. No tag cache,
// no revalidation queue. Cache interception stays off: it does not support PPR,
// which `cacheComponents` enables.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
