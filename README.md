# SahFund

SahFund is a two-person finance workspace for engaged couples in Indonesia: it imports the shared bank pocket statement (**Impor mutasi** — a Bank Jago PDF, or a CSV export from any other bank), reconciles it against the closing balance the bank itself prints ("Cocok dengan saldo bank"), categorises where the money went, and forecasts whether the wedding is funded by its date. It replaces the spreadsheet and the "we think we're fine" conversation with one report both partners can read — sold once per wedding, not as a subscription.

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router) on Cloudflare Workers via OpenNext |
| Database | Neon Postgres (ap-southeast-1) via the `neon-http` driver |
| ORM | Drizzle ORM |
| Auth | Better Auth — sessions in our own Postgres |
| Validation | Zod — one schema shared by client and server |
| Money | `BIGINT` minor units (1/100 rupiah) |
| Tests | `node:test` (unit), Playwright (e2e) |
| Styling | Tailwind CSS v4 (tokens in `@theme`, no JS config file) |

Two invariants that surprise newcomers:

- **Money is `BIGINT` minor units (1/100 rupiah).** Floats are banned from storage and arithmetic; parsing and formatting go through `src/core/money.ts` only (ITA §5).
- **Multi-table writes use `db.batch()`, never `db.transaction()`.** The `neon-http` driver has no interactive transactions (ITA ADR-02) — collect the statements, then fire one atomic batch.

## Repo layout

```
SahFund/
├── AGENTS.md          rules for changing code in this repo — read it first
├── opencode.jsonc     OpenCode agent configuration
├── docs/              Obsidian vault: ITA, BRD, PEP, UI design guide
│   └── README.md      documentation index
└── apps/
    └── frontend/      the Next.js 16 app (the only deployable)
        ├── e2e/       Playwright tests
        └── src/
            ├── app/         server components (reads) + route handlers (mutations)
            ├── core/        pure domain logic: reconcile, forecast, money — zero I/O
            ├── adapters/    StatementSource implementations (Jago PDF, generic CSV)
            ├── lib/         db schema + Neon client, session helpers, report aggregates
            └── components/  shared UI — presentational, no data fetching
```

The application layers follow AGENTS.md §5: `src/core` never touches I/O, adapters hide which bank produced a statement (ITA ADR-06), and route handlers are orchestration only.

## Getting started

Prerequisites: **Node.js ≥ 22.6** (ITA §3) and npm.

```bash
cd apps/frontend
npm install
```

Environment: the Neon project link (`.neon`) lives in `apps/frontend`. Fill `.env` from Neon (Neon CLI required):

```bash
cd apps/frontend
neon env pull        # writes .env
```

`.env` is shared; `.env.development` and `.env.production` override per mode. `.env` holds live credentials and is gitignored — only `.env.example` is tracked. Never commit it.

Then start the dev server:

```bash
npm run dev
```

Scripts (all run in `apps/frontend`): `npm run dev` · `npm run build` · `npm start` · `npm run lint` · `npm run test:e2e`.

## Testing

- **Unit** — `node:test` for pure logic in `src/core` and the adapters. Money and reconciliation tests are mandatory (formats, tampered amount, duplicate re-import — AGENTS.md §11).
- **E2E** — `npm run test:e2e` runs the Playwright suite (`playwright.config.ts`, tests in `e2e/`).

UI changes also need a manual pass over loading, empty, error, and keyboard-only paths before claiming done (AGENTS.md §6, §11).

## Health check

`GET /api/health` (short alias: `/health`) probes the database:

- `200` → `{"status":"ok","db":"up"}`
- `503` → `{"status":"error","db":"down"}` when Postgres is unreachable

The app never falls back to a blank dashboard or a zeroed-out total (ITA §2).

## Documentation

Start at **[docs/README.md](docs/README.md)** — the index of the `docs/` Obsidian vault (plain relative links, works in Obsidian and on GitHub).

Sources of truth, in order: **[ITA](docs/projects/ITA.md)** — architecture and ADRs (`ITA §N`); **[BRD](docs/projects/BRD.md)** — product scope and requirements (`BRD §N`); **[PEP](docs/projects/PEP.md)** — delivery plan and release gates (`PEP §N`). A citation like `BRD §3` means the heading `## 3. Scope`. If code and docs disagree, stop and ask — don't silently pick a side.

## Contributing

- **Read [AGENTS.md](AGENTS.md) before changing any code.** It is non-negotiable: correctness beats cleverness, the database enforces invariants, the UI never lies about state, the diff stays small.
- The stack is fixed (AGENTS.md §1) — don't swap drivers or add a dependency for what a few lines do.
- Every query is workspace-scoped; multi-table writes are one `db.batch()`; money never touches floats.
- New pure logic ships with `node:test` tests; the full checklist is the definition of done (AGENTS.md §12).
- Scope lives in the BRD — v1.0 exclusions (AGENTS.md §10) change through a BRD amendment, not a code change.
