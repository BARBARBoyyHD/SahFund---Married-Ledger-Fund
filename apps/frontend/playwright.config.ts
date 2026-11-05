import { defineConfig, devices } from "@playwright/test";

// 3100, not 3000: `next dev` may already own 3000, and the suite must run on the
// Workers runtime — plain `next start` cannot hold the D1 binding (SPEC §9, T6).
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `e2e:server` applies the local D1 migrations, then serves the app on
    // `next dev` — the platform proxy (initOpenNextCloudflareForDev) gives it a
    // real local D1 binding, so `/api/health` probes the database for real.
    //
    // The intended production runtime is `e2e:server:workers` (OpenNext build +
    // `wrangler dev`). It is wired and ready but cannot serve pages today:
    // `cacheComponents: true` in next.config.ts makes every page request hang
    // under @opennextjs/cloudflare 1.20.15 ("Worker's code had hung"), while
    // /api/health still answers 200. Switch the command below once that is
    // fixed — it is the same blocker PEP M1's deploy task will hit (SPEC R10).
    command: "npm run e2e:server",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
