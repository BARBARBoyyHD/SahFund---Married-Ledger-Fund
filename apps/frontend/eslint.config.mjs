import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Portability rules P1–P3 (SPEC-d1-migration §3.2): every dialect decision lives
// in schema.ts + db/index.ts. Ban the whole driver/dialect surface by group, then
// re-allow the query builder at the root and the two sanctioned subpaths in the
// two-file override below — a new `drizzle-orm/*` import fails here by default.
const PORTABILITY_IMPORTS = {
  paths: [
    {
      name: "drizzle-orm",
      importNames: ["sql"],
      message: "P1: raw SQL is banned outside schema.ts constraints and probeDb's `select 1`.",
    },
  ],
  patterns: [
    {
      group: ["drizzle-orm/*"],
      message:
        "P2/P3: driver and dialect subpaths are confined to src/lib/db/schema.ts and src/lib/db/index.ts.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build and test artifacts (OpenNext/Workers output, Playwright reports).
    ".open-next/**",
    ".wrangler/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", PORTABILITY_IMPORTS] },
  },
  {
    // P1/P2/P3 allowlist: the only two files that legitimately hold dialect knowledge.
    files: ["src/lib/db/schema.ts", "src/lib/db/index.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
