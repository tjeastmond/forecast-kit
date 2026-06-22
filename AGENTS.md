# AGENTS.md

Handoff guide for agents working on **forcast-kit** — a Bun/TypeScript monorepo that syncs Kalshi prediction markets into local SQLite and exposes them via CLI and HTTP API for downstream research agents.

Full product spec: [`Project_Plan.md`](Project_Plan.md). Release history: [`CHANGELOG.md`](CHANGELOG.md).

---

## Current status

| Phase              | Status        | Exit gate                                 |
| ------------------ | ------------- | ----------------------------------------- |
| 1 — Scaffold       | Done          | `bun run typecheck && bun run db:migrate` |
| 2 — Kalshi sync    | Done (v0.2.0) | Sync stores ≥1 open market in SQLite      |
| 3 — Query & filter | Done locally  | First Success Criteria (see below)        |
| 4 — Agent export   | **Next**      | `GET /markets/:ticker/export` schema v1.0 |
| 5 — Multi-provider | Stub only     | Polymarket provider + registry            |

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
SQLite (Drizzle) — ./data/forcast-kit.db
      ↓
┌─────────────┬──────────────┐
│  Fastify    │  Ink CLI     │
│  /markets   │  sync, list  │
│  /events    │  inspect     │
└─────────────┴──────────────┘
```

**Rule:** Downstream code consumes **normalized** types from `@forcast-kit/core`, never raw Kalshi JSON (except `raw_json` columns for forward compatibility).

### Package dependency flow

```txt
apps/cli, apps/api  →  db, providers/*  →  core
providers/kalshi    →  core
providers/polymarket → core (stub)
```

---

## Directory structure

```txt
forcast-kit/
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
│
├── apps/
│   ├── api/                  # Fastify HTTP server (port 3847)
│   │   └── src/
│   │       ├── index.ts      # buildApp(), startServer()
│   │       └── routes/
│   │           ├── health.ts
│   │           ├── markets.ts    # /markets, /events, /sync
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
    │       └── logging/      # Structured JSON logs to stderr
    │
    ├── db/                   # Drizzle schema, repos, sync, query
    │   ├── migrations/
    │   │   └── 0000_omniscient_kree.sql
    │   └── src/
    │       ├── schema/       # events, markets, market_sides, market_focus_tags, sync_runs
    │       ├── client.ts     # createDatabase (Bun SQLite runtime)
    │       ├── database-client.ts  # DatabaseClient type (no bun:sqlite import)
    │       ├── repositories/ # Upsert repos + MarketFocusTagRepository
    │       ├── sync/service.ts     # SyncService
    │       ├── query/index.ts      # MarketQueryService, EventQueryService
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
        └── polymarket/           # Stub — Phase 5
            └── src/index.ts
```

---

## Root scripts (`package.json`)

Run all commands from the repo root with **Bun**.

| Script        | Command                                              | Purpose                                  |
| ------------- | ---------------------------------------------------- | ---------------------------------------- |
| `dev`         | `bun run apps/cli/src/index.tsx`                     | Run CLI interactively (Ink UI)           |
| `serve`       | `bun run apps/api/src/index.ts`                      | Start Fastify API on `127.0.0.1:3847`    |
| `sync:kalshi` | `bun run apps/cli/src/index.tsx sync kalshi --no-ui` | Non-interactive Kalshi sync              |
| `db:generate` | `drizzle-kit generate`                               | Generate migration from schema changes   |
| `db:migrate`  | `drizzle-kit migrate`                                | Apply migrations (uses `better-sqlite3`) |
| `lint`        | `eslint .`                                           | ESLint (strict TypeScript rules)         |
| `format`      | `prettier --write .`                                 | Format entire repo                       |
| `typecheck`   | `tsc --build`                                        | Project-reference TypeScript build       |
| `test`        | `vitest run`                                         | Run all `**/*.spec.ts` tests once        |
| `test:watch`  | `vitest`                                             | Watch mode for tests                     |

### Typical verification loop

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run typecheck
bun run lint
bun run test
```

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

Entry: `forcast-kit` (bin → `apps/cli/src/index.tsx`)

| Command       | Example                                                     |
| ------------- | ----------------------------------------------------------- |
| `sync kalshi` | `forcast-kit sync kalshi --focus politics --exclude sports` |
| `list`        | `forcast-kit list --focus politics --status open`           |
| `inspect`     | `forcast-kit inspect KXPRES-24-DEM`                         |
| `serve`       | `forcast-kit serve --port 3847`                             |

**Flags:** `--focus`, `--exclude`, `--status`, `--limit`, `--max-pages`, `--no-ui`, `--verbose`, `--help`

Use `--no-ui` for scripts and CI. Interactive sync uses Ink (`SyncApp.tsx`).

---

## HTTP API

Base URL: `http://127.0.0.1:3847`

| Method | Path                   | Notes                                                            |
| ------ | ---------------------- | ---------------------------------------------------------------- |
| `GET`  | `/health`              | `{ status, db }`                                                 |
| `GET`  | `/markets`             | Query: `focus`, `exclude`, `status`, `q`, `limit`, `cursor`      |
| `GET`  | `/markets/:ticker`     | Full detail: sides, focus tags, event, `raw_json`                |
| `GET`  | `/events`              | Same filters; `?includeMarkets=true`                             |
| `GET`  | `/events/:eventTicker` | Event + filtered markets                                         |
| `POST` | `/sync`                | Body: `{ provider, focus, exclude, maxPages }` → background sync |
| `GET`  | `/sync/:id`            | Sync run status and counts                                       |

List endpoints paginate with opaque base64url cursors (market/event id).

---

## Database (SQLite + Drizzle)

**File:** `./data/forcast-kit.db` (override with `FORCAST_KIT_DB_PATH`)

**Runtime:** Bun native SQLite (`packages/db/src/client.ts`)  
**Migrations / tests:** `better-sqlite3` (Drizzle Kit migrate + Vitest in-memory)

### Tables

| Table                     | Purpose                                                                         | Key constraints                                 |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| `events`                  | Kalshi events                                                                   | unique `(provider, event_ticker)`               |
| `markets`                 | Normalized markets + pricing columns                                            | unique `(provider, ticker)`                     |
| `market_sides`            | YES/NO (or other) investable sides                                              | unique `(market_id, side)`                      |
| `market_focus_tags`       | Derived focus labels per market                                                 | unique `(market_id, focus)`                     |
| `market_focus_tags.focus` | One of: politics, weather, economics, technology, crypto, entertainment, sports |
| `sync_runs`               | Sync audit trail                                                                | status: running \| success \| partial \| failed |

Schema source: `packages/db/src/schema/index.ts`  
Migration: `packages/db/migrations/0000_omniscient_kree.sql`

**After schema changes:** `bun run db:generate` then `bun run db:migrate`.

### Key modules

| Module                     | Role                                                     |
| -------------------------- | -------------------------------------------------------- |
| `createDatabase(path)`     | Open/create SQLite with WAL                              |
| `createRepositories(db)`   | Event, Market, MarketSide, MarketFocusTag, SyncRun repos |
| `createSyncService(repos)` | Orchestrate provider → DB; focus filter on sync          |
| `createQueryServices(db)`  | `markets`, `events`, `syncRuns` query services           |

**Subpath exports** (avoid pulling `bun:sqlite` in Vitest):

- `@forcast-kit/db/query`
- `@forcast-kit/db/repositories`
- `@forcast-kit/db/test-utils`

---

## Focus tagging

Rules live in `packages/core/src/focus/rules.json` (category, series prefix, keywords).

- **Sync:** `--focus` / `--exclude` filter which markets are persisted (tags always derived first).
- **Query:** Same filters via CLI flags or API query params (OR for focus, then exclude).
- **Functions:** `deriveFocusTags()`, `matchesFocusFilter()`, `shouldPersistMarket()` in `@forcast-kit/core`.

Edit `rules.json` to tune classification without schema migrations.

---

## Provider abstraction

```ts
interface PredictionMarketProvider {
  readonly id: 'kalshi' | 'polymarket';
  fetchOpenEvents(options?: FetchOptions): AsyncGenerator<ProviderEventBatch>;
  fetchMarket(ticker: string): Promise<ProviderMarket | null>;
}
```

- **Kalshi:** `packages/providers/kalshi` — production integration
- **Polymarket:** stub throws `NotImplemented` — Phase 5

Kalshi uses public endpoints (no API keys required for MVP sync). Optional auth env vars exist for future protected endpoints.

---

## Configuration (`.env`)

| Variable                  | Default                                        | Purpose                          |
| ------------------------- | ---------------------------------------------- | -------------------------------- |
| `FORCAST_KIT_DB_PATH`     | `./data/forcast-kit.db`                        | SQLite file                      |
| `FORCAST_KIT_API_HOST`    | `127.0.0.1`                                    | API bind host                    |
| `FORCAST_KIT_API_PORT`    | `3847`                                         | API bind port                    |
| `KALSHI_API_BASE_URL`     | `https://external-api.kalshi.com/trade-api/v2` | Kalshi REST base                 |
| `KALSHI_API_KEY_ID`       | —                                              | Optional auth                    |
| `KALSHI_PRIVATE_KEY_PATH` | —                                              | Optional PEM for RSA-PSS         |
| `SYNC_PAGE_LIMIT`         | `200`                                          | Max records per Kalshi page      |
| `SYNC_REQUEST_DELAY_MS`   | `100`                                          | Delay between paginated requests |

Load via `loadConfig()` from `@forcast-kit/core`.

---

## Testing

- **Pattern:** `**/*.spec.ts` only (not `.test.ts`)
- **Runner:** Vitest (`vitest.config.ts`)
- **Fixtures:** `packages/providers/kalshi/fixtures/events-page.json`
- **DB tests:** `createTestDatabase()` from `@forcast-kit/db/test-utils` (applies migration SQL to `:memory:`)

Do **not** import `@forcast-kit/db` main entry in Vitest-only test files if you only need query/repos — use subpath exports to avoid `bun:sqlite` under Vite.

---

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.). No AI attribution in commit messages.
- **TypeScript:** Strict; use exhaustive switches with `never` default; no inline imports.
- **Issues:** Log bugs in `.ai/issues.md` (create if missing).
- **Scope:** Minimize diffs; match existing patterns; don't over-engineer.

---

## Phase 4 — what to build next

1. `GET /markets/:ticker/export` — stable JSON schema v1.0 for LLM context
2. Derived metrics: spread, mid price, implied probability
3. Incremental sync via Kalshi `min_updated_ts`
4. Stale-market flagging for markets absent from latest sync

See [`Project_Plan.md`](Project_Plan.md) § Agent export and Phase 4 exit gate.

---

## Quick reference: where to change things

| Task                 | Location                                                         |
| -------------------- | ---------------------------------------------------------------- |
| Add env var          | `packages/core/src/config/index.ts`, `.env.example`              |
| Change DB schema     | `packages/db/src/schema/index.ts` → `db:generate` → `db:migrate` |
| Kalshi field mapping | `packages/providers/kalshi/src/normalizer.ts`, `schemas.ts`      |
| Focus rules          | `packages/core/src/focus/rules.json`                             |
| Sync behavior        | `packages/db/src/sync/service.ts`                                |
| List/filter queries  | `packages/db/src/query/index.ts`                                 |
| API routes           | `apps/api/src/routes/markets.ts`                                 |
| CLI commands         | `apps/cli/src/commands/`                                         |
