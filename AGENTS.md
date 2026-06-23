# AGENTS.md

Handoff guide for agents working on **forecast-kit** — a Bun/TypeScript monorepo that syncs Kalshi prediction markets into local SQLite and exposes them via CLI and HTTP API for downstream research agents.

Full product spec: [`Project_Plan.md`](Project_Plan.md). Release history: [`CHANGELOG.md`](CHANGELOG.md). Remaining polish and post-MVP work: [`.ai/handoff-remaining.md`](.ai/handoff-remaining.md).

---

## Current status

| Phase              | Status        | Exit gate                                 |
| ------------------ | ------------- | ----------------------------------------- |
| 1 — Scaffold       | Done (v0.1.0) | `bun run typecheck && bun run db:migrate` |
| 2 — Kalshi sync    | Done (v0.2.0) | Sync stores ≥1 open market in SQLite      |
| 3 — Query & filter | Done (v0.3.0) | First Success Criteria (see below)        |
| 4 — Agent export   | Done (v0.4.0) | `GET /markets/:ticker/export` schema v1.0 |
| 5 — Multi-provider | Done (v0.5.0) | `ProviderRegistry`; Polymarket stub + CI  |

**Non-goals (MVP):** trading, WebSocket streaming, prediction logic, multi-user auth, hosted deployment.

---

## Architecture

```txt
Kalshi REST API
      ↓
KalshiProvider (fetch + paginate + Zod validate)
      ↓
Normalizer → NormalizedEvent / NormalizedMarket / NormalizedMarketSide
      ↓
SyncService (upsert + focus tagging + sync_runs audit)
      ↓
SQLite (Drizzle) — ./data/forecast-kit.db
      ↓
┌─────────────┬──────────────┬──────────────┐
│  Fastify    │  Ink CLI     │  Next.js UI  │
│  /markets   │  sync, list  │  :3848       │
│  /events    │  inspect     │  cards/sheet │
└─────────────┴──────────────┴──────────────┘
```

**Rule:** Downstream code consumes **normalized** types from `@forecast-kit/core`, never raw Kalshi JSON (except `raw_json` columns for forward compatibility).

### Package dependency flow

```txt
apps/cli, apps/api, apps/ui  →  db (api only), providers/*  →  core
apps/ui                     →  HTTP to apps/api only
providers/kalshi    →  core
providers/polymarket → core (fetch stub; registered in API)
core/providers     → registry for kalshi + polymarket
```

---

## Directory structure

```txt
forecast-kit/
├── AGENTS.md                 # This file
├── Project_Plan.md           # Full MVP spec, schema, API contracts, phases
├── CHANGELOG.md
├── package.json              # Root scripts + Bun workspaces
├── tsconfig.base.json        # strict TS (exactOptionalPropertyTypes, etc.)
├── drizzle.config.ts         # Drizzle Kit → packages/db/migrations
├── vitest.config.ts          # Tests: **/*.spec.ts only
├── eslint.config.js
├── prettier.config.js
├── .env.example
├── .github/workflows/ci.yml
│
├── apps/
│   ├── api/                  # Fastify HTTP server (port 3847)
│   │   └── src/
│   │       ├── index.ts      # buildApp(), startServer()
│   │       └── routes/
│   │           ├── health.ts
│   │           ├── markets.ts    # /markets, /export, /events, /sync
│   │           └── markets.spec.ts
│   │
│   └── cli/                  # Ink TUI + command router
│       └── src/
│           ├── index.tsx     # Entry; --no-ui for scripts/CI
│           ├── args.ts       # Flag parsing, HELP_TEXT
│           ├── commands/
│           │   ├── index.ts  # Command router
│           │   ├── sync.ts
│           │   └── list.ts   # list + inspect
│           └── ui/
│               ├── App.tsx
│               └── SyncApp.tsx
│
└── packages/
    ├── core/                 # Domain types, config, focus rules, logger
    │   └── src/
    │       ├── types/        # NormalizedEvent, NormalizedMarket, PredictionMarketProvider
    │       ├── focus/
    │       │   ├── rules.json    # Data-driven focus tagging (editable)
    │       │   ├── rules.ts      # deriveFocusTags, matchesFocusFilter
    │       │   └── rules.spec.ts
    │       ├── config/       # Zod env loader (loadConfig)
    │       ├── logging/      # Structured JSON logs to stderr
    │       ├── metrics/      # deriveMarketMetrics (spread, mid, implied prob)
    │       ├── export/       # marketExportV1Schema, buildMarketExport
    │       └── providers/    # ProviderRegistry
    │
    ├── db/                   # Drizzle schema, repos, sync, query
    │   ├── migrations/
    │   │   ├── 0000_omniscient_kree.sql
    │   │   └── 0001_add_market_stale.sql
    │   └── src/
    │       ├── schema/       # events, markets, market_sides, market_focus_tags, sync_runs
    │       ├── client.ts     # createDatabase (Bun SQLite runtime)
    │       ├── database-client.ts  # DatabaseClient type (no bun:sqlite import)
    │       ├── repositories/ # Upsert repos + MarketFocusTagRepository
    │       ├── sync/service.ts     # SyncService
    │       ├── query/index.ts      # MarketQueryService, EventQueryService
    │       ├── export/index.ts     # Agent export schema v1.0
    │       └── test-utils.ts       # In-memory DB for Vitest (better-sqlite3)
    │
    └── providers/
        ├── kalshi/
        │   ├── fixtures/events-page.json
        │   └── src/
        │       ├── provider.ts     # KalshiProvider
        │       ├── client.ts       # HTTP + retry/backoff
        │       ├── schemas.ts      # Zod Kalshi payloads
        │       ├── normalizer.ts
        │       └── parse-decimal.ts
        └── polymarket/           # Fetch stub; DESIGN.md field mapping
            ├── DESIGN.md
            └── src/index.ts
```

---

## Root scripts (`package.json`)

Run all commands from the repo root with **Bun**.

| Script        | Command                                              | Purpose                                        |
| ------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `dev`         | `bun run apps/cli/src/index.tsx`                     | Run CLI interactively (Ink UI)                 |
| `serve`       | `bun run apps/api/src/index.ts`                      | Start Fastify API on `127.0.0.1:3847`          |
| `ui`          | `bun run serve & bun run ui:app`                     | API + explorer UI (`127.0.0.1:3847` + `:3848`) |
| `ui:app`      | `bun run --filter @forecast-kit/ui dev`              | Next.js UI only (API must already be running)  |
| `dev:explore` | `bun run ui`                                         | Alias for `ui`                                 |
| `sync:kalshi` | `bun run apps/cli/src/index.tsx sync kalshi --no-ui` | Non-interactive Kalshi sync                    |
| `db:generate` | `drizzle-kit generate`                               | Generate migration from schema changes         |
| `db:migrate`  | `drizzle-kit migrate`                                | Apply migrations (uses `better-sqlite3`)       |
| `lint`        | `eslint .`                                           | ESLint (strict TypeScript rules)               |
| `format`      | `prettier --write .`                                 | Format entire repo                             |
| `typecheck`   | `tsc --build`                                        | Project-reference TypeScript build             |
| `test`        | `vitest run`                                         | Run all `**/*.spec.ts` tests once              |
| `test:watch`  | `vitest`                                             | Watch mode for tests                           |

### Typical verification loop

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run format
bun run typecheck
bun run lint
bun run test
```

**Before commit or push:** all four quality checks (`format`, `typecheck`, `lint`, `test`) must pass. Do not push to the remote if any check fails.

### First Success Criteria (Phase 3 exit gate)

```bash
bun run sync:kalshi -- --focus politics,weather --exclude sports
# Optional for faster dev: --max-pages 3

bun run serve
```

Second terminal:

```bash
curl -s 'http://127.0.0.1:3847/markets?focus=politics&limit=5'
curl -s 'http://127.0.0.1:3847/markets/<ticker>'
bun run apps/cli/src/index.tsx list --focus politics
bun run apps/cli/src/index.tsx inspect <ticker>
```

---

## CLI

Entry: `forecast-kit` (bin → `apps/cli/src/index.tsx`)

| Command       | Example                                                      |
| ------------- | ------------------------------------------------------------ |
| `sync kalshi` | `forecast-kit sync kalshi --focus politics --exclude sports` |
| `list`        | `forecast-kit list --focus politics --status open`           |
| `events`      | `forecast-kit events --focus politics`                       |
| `inspect`     | `forecast-kit inspect KXPRES-24-DEM`                         |
| `serve`       | `forecast-kit serve --port 3847`                             |

**Flags:** `--focus`, `--exclude`, `--category`, `--tag`, `--status`, `--limit`, `--max-pages`, `--full`, `--no-ui`, `--verbose`, `--help`

Use `--no-ui` for scripts and CI. Interactive sync uses Ink (`SyncApp.tsx`). CLI sync resolves providers via `ProviderRegistry` (default `kalshi`).

---

## HTTP API

Base URL: `http://127.0.0.1:3847`

| Method  | Path                                | Notes                                                                                   |
| ------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `GET`   | `/health`                           | `{ status, db }`                                                                        |
| `GET`   | `/markets`                          | Query: `focus`, `exclude`, `category`, `tag`, `status`, `stale`, `q`, `limit`, `cursor` |
| `GET`   | `/markets/:ticker`                  | Full detail; `?includeMetrics=true` adds spread/mid/implied                             |
| `GET`   | `/markets/:ticker/export`           | Agent export JSON schema v1.0 (spread, mid, implied prob)                               |
| `GET`   | `/events`                           | Same filters; `?includeMarkets=true`                                                    |
| `GET`   | `/events/:eventTicker`              | Event + markets; `?includeMetrics=true` for comparison columns                          |
| `GET`   | `/taxonomy`                         | Kalshi categories + tags from last taxonomy sync                                        |
| `GET`   | `/taxonomy/series`                  | Browse synced series (`?category=`, `?limit=`)                                          |
| `POST`  | `/sync`                             | Body: `{ provider, focus, exclude, maxPages, full }` → background sync                  |
| `POST`  | `/sync/taxonomy`                    | Refresh Kalshi category/tag/series metadata (`{ full?: boolean }`)                      |
| `GET`   | `/sync`                             | Paginated sync run list                                                                 |
| `GET`   | `/sync/:id`                         | Sync run status and counts                                                              |
| `PATCH` | `/admin/markets/:ticker`            | Focused manual edits (local dev only)                                                   |
| `PUT`   | `/admin/markets/:ticker/focus-tags` | Replace focus tags                                                                      |

List endpoints paginate with opaque base64url cursors (market/event id).

**Scheduled refresh (external cron):** taxonomy sync runs automatically at the start of each `POST /sync`. For periodic updates without manual triggers:

```bash
# Every 6h: refresh taxonomy, then incremental market sync
0 */6 * * * curl -s -X POST http://127.0.0.1:3847/sync/taxonomy
15 */6 * * * curl -s -X POST http://127.0.0.1:3847/sync -H 'Content-Type: application/json' -d '{"provider":"kalshi"}'
```

---

## Database (SQLite + Drizzle)

**File:** `./data/forecast-kit.db` (override with `FORECAST_KIT_DB_PATH`)

**Runtime:** Bun native SQLite (`packages/db/src/client.ts`)  
**Migrations / tests:** `better-sqlite3` (Drizzle Kit migrate + Vitest in-memory)

### Tables

| Table                     | Purpose                                                                         | Key constraints                                 |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| `events`                  | Kalshi events                                                                   | unique `(provider, event_ticker)`               |
| `markets`                 | Normalized markets + pricing columns; `is_stale` after full sync                | unique `(provider, ticker)`                     |
| `market_sides`            | YES/NO (or other) investable sides                                              | unique `(market_id, side)`                      |
| `market_focus_tags`       | Derived focus labels per market                                                 | unique `(market_id, focus)`                     |
| `market_focus_tags.focus` | One of: politics, weather, economics, technology, crypto, entertainment, sports |
| `sync_runs`               | Sync audit trail                                                                | status: running \| success \| partial \| failed |

Schema source: `packages/db/src/schema/index.ts`  
Migrations: `packages/db/migrations/0000_omniscient_kree.sql`, `0001_add_market_stale.sql`

### Events vs markets

Kalshi “questions” map to **`events`**; tradable outcomes map to **`markets`**, linked by `markets.event_ticker`.

Example: event `KXNEXTDNCCHAIR-45` (“Who will be the next DNC Chair?”) has many markets (`KXNEXTDNCCHAIR-45-PBUT`, …). Use `GET /events/:eventTicker` or `forecast-kit events KXNEXTDNCCHAIR-45` to fetch the parent question and all outcomes.

### Stored vs derived pricing

**Persisted on `markets` at sync:** `volume`, `volume_24h`, `open_interest`, `liquidity`, `yes_bid`, `yes_ask`, `no_bid`, `no_ask`, `last_price` (Kalshi dollars 0–1 ≈ implied %). Also denormalized on `market_sides` (`bid`, `ask`, `price`).

**Computed at export only** (`deriveMarketMetrics` in `@forecast-kit/core`): spread, mid price, implied probability (`last_price` ?? Yes mid). Not stored as DB columns. Each market’s probability is independent (not normalized across an event).

**After schema changes:** `bun run db:generate` then `bun run db:migrate`.

### Key modules

| Module                     | Role                                                     |
| -------------------------- | -------------------------------------------------------- |
| `createDatabase(path)`     | Open/create SQLite with WAL                              |
| `createRepositories(db)`   | Event, Market, MarketSide, MarketFocusTag, SyncRun repos |
| `createSyncService(repos)` | Orchestrate provider → DB; focus filter on sync          |
| `createQueryServices(db)`  | `markets`, `events`, `syncRuns` query services           |

**Subpath exports** (avoid pulling `bun:sqlite` in Vitest):

- `@forecast-kit/db/query`
- `@forecast-kit/db/repositories`
- `@forecast-kit/db/export`
- `@forecast-kit/db/test-utils`

---

## Focus tagging

Rules live in `packages/core/src/focus/rules.json` (category, series prefix, keywords).

- **Sync:** `--focus` / `--exclude` filter which markets are persisted (tags always derived first).
- **Query:** Same filters via CLI flags or API query params (OR for focus, then exclude).
- **Functions:** `deriveFocusTags()`, `matchesFocusFilter()`, `shouldPersistMarket()` in `@forecast-kit/core`.

Edit `rules.json` to tune classification without schema migrations. Keyword matching is substring-based (e.g. keyword `AI` can false-positive on words like “Chair”).

---

## Provider abstraction

```ts
interface PredictionMarketProvider {
  readonly id: 'kalshi' | 'polymarket';
  fetchOpenEvents(options?: FetchOptions): AsyncGenerator<ProviderEventBatch>;
  fetchMarket(ticker: string): Promise<ProviderMarket | null>;
}
```

- **Kalshi:** `packages/providers/kalshi` — production integration; incremental sync via `min_updated_ts`
- **Polymarket:** `packages/providers/polymarket` — registered in `ProviderRegistry`; fetch still throws `NotImplemented` (see `DESIGN.md`)
- **Registry:** `createProviderRegistry()` in `packages/core/src/providers/registry.ts`; API `POST /sync` resolves provider by id

Kalshi uses public endpoints (no API keys required for MVP sync). Optional auth env vars exist for future protected endpoints.

---

## Configuration (`.env`)

| Variable                  | Default                                        | Purpose                          |
| ------------------------- | ---------------------------------------------- | -------------------------------- |
| `FORECAST_KIT_DB_PATH`    | `./data/forecast-kit.db`                       | SQLite file                      |
| `FORECAST_KIT_API_HOST`   | `127.0.0.1`                                    | API bind host                    |
| `FORECAST_KIT_API_PORT`   | `3847`                                         | API bind port                    |
| `KALSHI_API_BASE_URL`     | `https://external-api.kalshi.com/trade-api/v2` | Kalshi REST base                 |
| `KALSHI_API_KEY_ID`       | —                                              | Optional auth                    |
| `KALSHI_PRIVATE_KEY_PATH` | —                                              | Optional PEM for RSA-PSS         |
| `SYNC_PAGE_LIMIT`         | `200`                                          | Max records per Kalshi page      |
| `SYNC_REQUEST_DELAY_MS`   | `100`                                          | Delay between paginated requests |

Load via `loadConfig()` from `@forecast-kit/core`.

---

## Testing

- **Pattern:** `**/*.spec.ts` only (not `.test.ts`)
- **Runner:** Vitest (`vitest.config.ts`)
- **Fixtures:** `packages/providers/kalshi/fixtures/events-page.json`
- **DB tests:** `createTestDatabase()` from `@forecast-kit/db/test-utils` (applies migration SQL to `:memory:`)

Do **not** import `@forecast-kit/db` main entry in Vitest-only test files if you only need query/repos — use subpath exports to avoid `bun:sqlite` under Vite.

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.). No AI attribution in commit messages.
- **TypeScript:** Strict; use exhaustive switches with `never` default; no inline imports.
- **Issues:** Log bugs in `.ai/issues.md` (create if missing).
- **Scope:** Minimize diffs; match existing patterns; don't over-engineer.
- **Explorer UI copy:** Headings, buttons, form labels, and icon `aria-label`s use Title Case (see `.cursor/rules/ui-title-case.mdc`, `apps/ui/AGENTS.md`).

### Versioning

| Rule                | Detail                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| **Current release** | `0.5.0` (MVP complete). Historical `0.1.0`–`0.5.0` entries stay as-is.     |
| **Day-to-day**      | Log changes under `[Unreleased]` in `CHANGELOG.md`.                        |
| **Default bump**    | **Patch** only — `0.5.1`, `0.5.2`, … when cutting a release.               |
| **Minor bump**      | `0.6.0` only when the user explicitly asks or agrees to a larger release.  |
| **Major / 1.0.0**   | Only on explicit user instruction. Do not promote to `1.0.0` autonomously. |
| **Avoid**           | One minor version per phase, milestone, or significant commit.             |

Do not bump `package.json` workspace versions (`0.0.0` placeholders) unless the user asks; **`CHANGELOG.md` is the product version source of truth.**

Cursor rule: [`.cursor/rules/pre-commit-checks.mdc`](.cursor/rules/pre-commit-checks.mdc) — format, typecheck, lint, test; no commit/push on failure.

---

## MVP status

Phases 1–5 are complete (v0.5.0). Post-MVP work: implement Polymarket fetch per `packages/providers/polymarket/DESIGN.md`, trading, WebSockets, or hosted deployment remain out of scope per [`Project_Plan.md`](Project_Plan.md) non-goals.

---

## Quick reference: where to change things

| Task                 | Location                                                            |
| -------------------- | ------------------------------------------------------------------- |
| Add env var          | `packages/core/src/config/index.ts`, `.env.example`                 |
| Change DB schema     | `packages/db/src/schema/index.ts` → `db:generate` → `db:migrate`    |
| Kalshi field mapping | `packages/providers/kalshi/src/normalizer.ts`, `schemas.ts`         |
| Focus rules          | `packages/core/src/focus/rules.json`                                |
| Sync behavior        | `packages/db/src/sync/service.ts`                                   |
| List/filter queries  | `packages/db/src/query/index.ts`                                    |
| API routes           | `apps/api/src/routes/markets.ts`                                    |
| CLI commands         | `apps/cli/src/commands/`                                            |
| Explorer UI          | `apps/ui/` (see `apps/ui/AGENTS.md`)                                |
| Agent export         | `packages/db/src/export/index.ts`, `apps/api/src/routes/markets.ts` |
| Provider registry    | `packages/core/src/providers/registry.ts`                           |

---

## Learned User Preferences

- Update `CHANGELOG.md` for notable changes under `[Unreleased]`; cut a **patch** release (`0.5.x`) when appropriate — do not bump minor/major without explicit user approval.
- Before every **commit or push**, run `bun run format`, `bun run typecheck`, `bun run lint`, and `bun run test` — all must pass; never push if any check fails.
- When committing from mixed WIP, stage and push only files related to the current change; exclude unrelated work-in-progress.
- When directed to continue through the plan, loop autonomously through phases until MVP exit gates pass without pausing between phases for approval.
- Initial commits should document what changed (via CHANGELOG `[Unreleased]` entries and conventional commit messages).
- Version line stays at **0.5.x** (patch) until the user requests a minor (`0.6.0`) or major (`1.0.0`) bump.
- Mirror **applied.dev** visual/UX patterns (card lists, filters, detail sheets) when building or extending `apps/ui`.

---

## Learned Workspace Facts

- Repo bootstrapped at `/Users/tjeastmond/Projects/forecast-kit` with `Project_Plan.md` copied from sibling `forecastkit.dev`.
- GitHub Actions CI (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, and `test` on push/PR to `main`.
- Post-MVP polish is complete; `.ai/handoff-remaining.md` lists done items and explicit out-of-scope work; track bugs in `.ai/issues.md`.
- Sibling design reference **applied.dev** lives at `/Users/tjeastmond/Projects/applied.dev` (Next.js 15, shadcn, card-based list UI).
