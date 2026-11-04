import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Portability rules P1–P3 (SPEC-d1-migration §3.2): every dialect decision lives
// in schema.ts + db/index.ts, so the two files that may import these are
// re-allowed below.
const PORTABILITY_IMPORTS = [
  {
    name: "drizzle-orm/d1",
    message: "P3: only src/lib/db/index.ts imports the driver — it is the single swap point.",
  },
  {
    name: "drizzle-orm/sqlite-core",
    message: "P2: dialect types live only in src/lib/db/schema.ts.",
  },
  {
    name: "drizzle-orm",
    importNames: ["sql"],
    message: "P1: raw SQL is banned outside schema.ts constraints and probeDb's `select 1`.",
  },
];

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
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { paths: PORTABILITY_IMPORTS }] },
  },
  {
    // P1/P2/P3 allowlist: the only two files that legitimately hold dialect knowledge.
    files: ["src/lib/db/schema.ts", "src/lib/db/index.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
