#!/usr/bin/env node
/**
 * M2 residue gate — SPEC-d1-migration §5.4b.
 *
 * `@neondatabase`, `neon-http` and `DATABASE_URL` must not come back into the
 * repository. Tracked files only: gitignored local state (`.env`, `.wrangler/`)
 * is not part of what ships. Run with `npm run check:residue`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BANNED = /@neondatabase|neon-http|DATABASE_URL/i;
// `.env*` is scanned too: an accidentally committed `.env.production` is exactly the
// residue this gate exists to catch, and the extension list alone cannot match it.
const SCANNED = /\.env(?:\.[^/]*)?$|\.(md|ts|tsx|mts|json|jsonc|mjs|ya?ml|example)$/;

// Deliberate residue (§5.4b allowlist) — every entry says why it stays.
const ALLOWLIST = new Map([
  ["docs/projects/SPEC-d1-migration.md", "the change spec itself — it names the tokens it removes"],
  ["docs/projects/ITA.md", "ADR-02 row kept as superseded history (§5.2)"],
  ["docs/projects/PEP.md", "historical risk/task rows quoted as history (§5.4)"],
  ["AGENTS.md", "names the banned driver only to forbid it (§1)"],
  ["apps/frontend/package-lock.json", "drizzle-orm's optional peer-dependency metadata"],
  ["apps/frontend/scripts/check-residue.mjs", "the gate itself names the tokens it bans (BANNED regex + header comment)"],
]);

// Anchored on this file, not the caller's cwd, so `npm run check:residue` and a bare
// `node scripts/check-residue.mjs` from any directory scan the same tree.
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: import.meta.dirname,
  encoding: "utf8",
}).trim();
const files = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => file && SCANNED.test(file));

const offenders = [];
const allowed = [];
let readable = 0;

for (const file of files) {
  let lines;
  try {
    lines = readFileSync(join(root, file), "utf8").split("\n");
  } catch {
    continue; // tracked but deleted in the working tree
  }
  readable += 1;
  lines.forEach((line, index) => {
    if (!BANNED.test(line)) return;
    (ALLOWLIST.has(file) ? allowed : offenders).push(`${file}:${index + 1}: ${line.trim()}`);
  });
}

// A gate that reads nothing passes vacuously — the failure mode this script was
// fixed for. Fail loudly instead of reporting a clean scan of zero files.
if (readable === 0) {
  console.error("✖ M2 residue gate read no files — the git ls-files path does not resolve.");
  process.exit(1);
}

if (allowed.length > 0) {
  console.log(`Allowlisted residue (${allowed.length}) — §5.4b:`);
  for (const hit of allowed) console.log(`  · ${hit}`);
}

if (offenders.length > 0) {
  console.error(`\n✖ M2 residue gate failed — ${offenders.length} hit(s) outside the allowlist:`);
  for (const hit of offenders) console.error(`  ${hit}`);
  console.error("\nRemove the Neon-era token, or add the file to ALLOWLIST with a reason.");
  process.exit(1);
}

console.log(`\n✔ M2 residue gate passed — no banned Neon tokens in ${readable}/${files.length} tracked files.`);
