# AGENTS.md

Handoff guide for agents working on **forecast-kit** — a Bun/TypeScript monorepo that syncs Kalshi prediction markets into local SQLite and exposes them via CLI, HTTP API, and browser explorer for downstream research agents.

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
Kalshi REST API (events, markets, taxonomy)
      ↓
KalshiProvider (fetch + paginate + Zod validate)
      ↓
Normalizer → NormalizedEvent / NormalizedMarket / NormalizedMarketSide
      ↓
┌──────────────────────────────┬───────────────────────────────────────┐
│ TaxonomySyncService          │ SyncService                           │
│ categories, tags, series     │ upsert + focus tagging + sync_runs    │
│ (refreshed before market     │ (+ targeted Mentions discovery pass   │
│  sync and via POST           │  on incremental runs)                 │
│  /sync/taxonomy)             │                                       │
└──────────────┬───────────────┴──────────────────┬────────────────────┘
               ↓                                  ↓
SQLite (Drizzle) — ./data/forecast-kit.db
      ↓
┌─────────────┬──────────────┬─────────────────────────────────────────┐
│  Fastify    │  Ink CLI     │  Next.js UI (:3848)                     │
│  :3847      │  sync, list  │  events-first explorer (/events default)  │
│  /markets   │  events,     │  event detail + market cards + sheet    │
│  /events    │  inspect     │  /api/* rewrites → Fastify (same-origin)│
│  /taxonomy  │              │                                         │
│  /admin     │              │                                         │
└─────────────┴──────────────┴─────────────────────────────────────────┘
```

**Rule:** Downstream code consumes **normalized** types from `@forecast-kit/core`, never raw Kalshi JSON (except `raw_json` columns for forward compatibility).

### Package dependency flow

```txt
apps/cli, apps/api  →  db, providers/*  →  core
apps/ui             →  HTTP via /api proxy to apps/api only (no db/providers)
providers/kalshi, polymarket  →  core
core/providers    →  registry for kalshi + polymarket
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
├── scripts/
│   └── dev-explore.ts        # Start API + UI; clean .next; coordinated shutdown
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
│   │       ├── plugins/cors.ts
│   │       └── routes/
│   │           ├── health.ts
│   │           ├── markets.ts    # /markets, /events, /sync
│   │           ├── taxonomy.ts   # /taxonomy, /taxonomy/tags, /taxonomy/series
│   │           ├── admin.ts      # PATCH/PUT admin market edits
│   │           └── *.spec.ts
│   │
│   ├── cli/                  # Ink TUI + command router
│   │   └── src/
│   │       ├── index.tsx     # Entry; --no-ui for scripts/CI
│   │       ├── args.ts       # Flag parsing, HELP_TEXT
│   │       ├── commands/
│   │       │   ├── index.ts  # Command router
│   │       │   ├── sync.ts
│   │       │   ├── list.ts   # list + inspect
│   │       │   └── events.ts # events list + event detail
│   │       └── ui/
│   │           ├── App.tsx
│   │           └── SyncApp.tsx
│   │
│   └── ui/                   # Next.js explorer (port 3848); see apps/ui/AGENTS.md
│       └── src/
│           ├── app/          # /events, /events/[eventTicker], /markets → redirect
│           ├── components/   # cards, sheet, filters, sync dialog
│           └── lib/api.ts    # HTTP client (defaults to /api proxy)
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
    ├── db/                   # Drizzle schema, repos, sync, query, taxonomy
    │   ├── migrations/
    │   │   ├── 0000_omniscient_kree.sql
    │   │   ├── 0001_add_market_stale.sql
    │   │   └── 0002_add_kalshi_taxonomy.sql
    │   └── src/
    │       ├── schema/       # events, markets, sides, focus tags, sync_runs, taxonomy, sync_state
    │       ├── client.ts     # createDatabase (Bun SQLite runtime)
    │       ├── database-client.ts  # DatabaseClient type (no bun:sqlite import)
    │       ├── repositories/ # Upsert repos + taxonomy + MarketFocusTagRepository
    │       ├── sync/service.ts     # SyncService (taxonomy refresh + mentions discovery)
    │       ├── taxonomy/service.ts # TaxonomySyncService
    │       ├── query/index.ts      # MarketQueryService, EventQueryService
    │       ├── export/index.ts     # Agent export schema v1.0
    │       └── test-utils.ts       # In-memory DB for Vitest (better-sqlite3)
    │
    └── providers/
        ├── kalshi/
        │   ├── fixtures/     # events-page, tags-by-categories, series-list
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

| Script         | Command                                                  | Purpose                                                      |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `dev`          | `bun run apps/cli/src/index.tsx`                         | Run CLI interactively (Ink UI)                               |
| `serve`        | `bun run apps/api/src/index.ts`                          | Start Fastify API on `127.0.0.1:3847`                        |
| `ui`           | `bun run scripts/dev-explore.ts`                         | Clean `.next`, start API + UI; SIGTERM/SIGINT stops both     |
| `ui:app`       | `bun run --filter @forecast-kit/ui dev`                  | Clean `.next`, Next.js UI only (API must already be running) |
| `ui:build`     | `bun run --filter @forecast-kit/ui build`                | Production build of explorer UI only                         |
| `build`        | `tsc --build && bun run --filter @forecast-kit/ui build` | Compile CLI, API, packages, then explorer UI (pre-push)      |
| `dev:explore`  | `bun run ui`                                             | Alias for `ui`                                               |
| `sync:kalshi`  | `bun run apps/cli/src/index.tsx sync kalshi --no-ui`     | Non-interactive Kalshi sync                                  |
| `db:generate`  | `drizzle-kit generate`                                   | Generate migration from schema changes                       |
| `db:migrate`   | `drizzle-kit migrate`                                    | Apply migrations (uses `better-sqlite3`)                     |
| `lint`         | `eslint .`                                               | ESLint (strict TypeScript rules)                             |
| `format`       | `prettier --write .`                                     | Format entire repo                                           |
| `format:check` | `prettier --check .`                                     | CI / verify formatting without writing                       |
| `typecheck`    | `tsc --build`                                            | Project-reference TypeScript build                           |
| `test`         | `vitest run`                                             | Run all `**/*.spec.ts` tests once                            |
| `test:watch`   | `vitest`                                                 | Watch mode for tests                                         |

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

**Before commit or push:** run `bun run build` plus the four quality checks (`format`, `typecheck`, `lint`, `test`); all must pass. Do not push to the remote if any check fails.

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
| `POST`  | `/events/:eventTicker/sync`         | Refresh one event and its markets from Kalshi                                           |
| `GET`   | `/taxonomy`                         | Kalshi categories + tags from last taxonomy sync (lazy-syncs if empty)                  |
| `GET`   | `/taxonomy/tags`                    | Tags for a category (`?category=`, `?provider=`)                                        |
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

| Table                     | Purpose                                                                                                | Key constraints                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `events`                  | Kalshi events                                                                                          | unique `(provider, event_ticker)`               |
| `markets`                 | Normalized markets + pricing columns; `is_stale` after full sync                                       | unique `(provider, ticker)`                     |
| `market_sides`            | YES/NO (or other) investable sides                                                                     | unique `(market_id, side)`                      |
| `market_focus_tags`       | Derived focus labels per market                                                                        | unique `(market_id, focus)`                     |
| `market_focus_tags.focus` | One of: politics, politicians, mentions, weather, economics, technology, crypto, entertainment, sports | enum in `FOCUS_VALUES`                          |
| `sync_runs`               | Sync audit trail                                                                                       | status: running \| success \| partial \| failed |
| `provider_categories`     | Kalshi categories from taxonomy sync                                                                   | unique `(provider, category)`                   |
| `provider_category_tags`  | Tags per category from taxonomy sync                                                                   | unique `(provider, category, tag)`              |
| `provider_series`         | Series metadata (category, tags) for focus derivation                                                  | unique `(provider, series_ticker)`              |
| `sync_state`              | Key/value store (e.g. taxonomy sync timestamps)                                                        | primary key `key`                               |

Schema source: `packages/db/src/schema/index.ts`  
Migrations: `packages/db/migrations/0000_omniscient_kree.sql`, `0001_add_market_stale.sql`, `0002_add_kalshi_taxonomy.sql`

### Events vs markets

Kalshi “questions” map to **`events`**; tradable outcomes map to **`markets`**, linked by `markets.event_ticker`.

Example: event `KXNEXTDNCCHAIR-45` (“Who will be the next DNC Chair?”) has many markets (`KXNEXTDNCCHAIR-45-PBUT`, …). Use `GET /events/:eventTicker` or `forecast-kit events KXNEXTDNCCHAIR-45` to fetch the parent question and all outcomes.

### Stored vs derived pricing

**Persisted on `markets` at sync:** `volume`, `volume_24h`, `open_interest`, `liquidity`, `yes_bid`, `yes_ask`, `no_bid`, `no_ask`, `last_price` (Kalshi dollars 0–1 ≈ implied %). Also denormalized on `market_sides` (`bid`, `ask`, `price`).

**Computed at export only** (`deriveMarketMetrics` in `@forecast-kit/core`): spread, mid price, implied probability (`last_price` ?? Yes mid). Not stored as DB columns. Each market’s probability is independent (not normalized across an event).

**After schema changes:** `bun run db:generate` then `bun run db:migrate`.

### Key modules

| Module                                       | Role                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `createDatabase(path)`                       | Open/create SQLite with WAL                                        |
| `createRepositories(db)`                     | Event, Market, MarketSide, MarketFocusTag, SyncRun repos           |
| `createSyncService(repos, taxonomy)`         | Orchestrate provider → DB; taxonomy refresh + focus filter on sync |
| `createTaxonomySyncService(repos, provider)` | Sync Kalshi categories, tags, and series metadata                  |
| `createQueryServices(db)`                    | `markets`, `events`, `syncRuns` query services                     |

**Subpath exports** (avoid pulling `bun:sqlite` in Vitest):

- `@forecast-kit/db/query`
- `@forecast-kit/db/repositories`
- `@forecast-kit/db/taxonomy`
- `@forecast-kit/db/export`
- `@forecast-kit/db/test-utils`

---

## Focus tagging

Rules live in `packages/core/src/focus/rules.json` (Kalshi categories/tags, series prefix, keywords).

- **Sync:** `--focus` / `--exclude` filter which markets are persisted (tags always derived first).
- **Query:** Same filters via CLI flags or API query params (OR for focus, then exclude). Also `?category=` and `?tag=` from synced taxonomy.
- **Functions:** `deriveFocusTags()`, `matchesFocusFilter()`, `shouldPersistMarket()` in `@forecast-kit/core`.
- **Taxonomy-aware:** Focus derivation uses synced series metadata (`provider_series.category`, `tags_json`) when available; falls back to market fields.

Edit `rules.json` to tune classification without schema migrations. Keyword matching uses word boundaries (e.g. `AI` no longer matches “Chair”).

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

| Variable                           | Default                                        | Purpose                                     |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `FORECAST_KIT_DB_PATH`             | `./data/forecast-kit.db`                       | SQLite file                                 |
| `FORECAST_KIT_API_HOST`            | `127.0.0.1`                                    | API bind host                               |
| `FORECAST_KIT_API_PORT`            | `3847`                                         | API bind port                               |
| `FORECAST_KIT_UI_PORT`             | `3848`                                         | Explorer UI port (Next.js dev)              |
| `FORECAST_KIT_API_URL`             | `http://127.0.0.1:3847`                        | Next.js `/api` rewrite target (server-side) |
| `NEXT_PUBLIC_FORECAST_KIT_API_URL` | — (uses `/api` proxy)                          | Optional direct API URL (requires CORS)     |
| `KALSHI_API_BASE_URL`              | `https://external-api.kalshi.com/trade-api/v2` | Kalshi REST base                            |
| `KALSHI_API_KEY_ID`                | —                                              | Optional auth                               |
| `KALSHI_PRIVATE_KEY_PATH`          | —                                              | Optional PEM for RSA-PSS                    |
| `SYNC_PAGE_LIMIT`                  | `200`                                          | Max records per Kalshi page                 |
| `SYNC_REQUEST_DELAY_MS`            | `100`                                          | Delay between paginated requests            |

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

| Rule                | Detail                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Current release** | `0.5.0` (MVP complete). `CHANGELOG.md` sections are titled by **date** (`## [YYYY-MM-DD]`; same-day follow-ups use `## [YYYY-MM-DD] 2`, `## [YYYY-MM-DD] 3`, …). |
| **Day-to-day**      | Log changes under `[Unreleased]` in `CHANGELOG.md`; cut a dated release section when shipping.                                                                   |
| **Semver labels**   | Optional in section body (e.g. `Release 0.5.0`); headings use dates, not version numbers.                                                                        |
| **Default bump**    | **Patch** only — `0.5.1`, `0.5.2`, … when cutting a semver-tagged release.                                                                                       |
| **Minor bump**      | `0.6.0` only when the user explicitly asks or agrees to a larger release.                                                                                        |
| **Major / 1.0.0**   | Only on explicit user instruction. Do not promote to `1.0.0` autonomously.                                                                                       |
| **Avoid**           | One minor version per phase, milestone, or significant commit.                                                                                                   |

Do not bump `package.json` workspace versions (`0.0.0` placeholders) unless the user asks; **`CHANGELOG.md` is the product version source of truth.**

Cursor rule: [`.cursor/rules/pre-commit-checks.mdc`](.cursor/rules/pre-commit-checks.mdc) — format, typecheck, lint, test; no commit/push on failure.

---

## MVP status

Phases 1–5 are complete (v0.5.0). Post-MVP work: implement Polymarket fetch per `packages/providers/polymarket/DESIGN.md`, trading, WebSockets, or hosted deployment remain out of scope per [`Project_Plan.md`](Project_Plan.md) non-goals.

---

## Quick reference: where to change things

| Task                 | Location                                                                 |
| -------------------- | ------------------------------------------------------------------------ |
| Add env var          | `packages/core/src/config/index.ts`, `.env.example`                      |
| Change DB schema     | `packages/db/src/schema/index.ts` → `db:generate` → `db:migrate`         |
| Kalshi field mapping | `packages/providers/kalshi/src/normalizer.ts`, `schemas.ts`              |
| Focus rules          | `packages/core/src/focus/rules.json`                                     |
| Sync behavior        | `packages/db/src/sync/service.ts`                                        |
| Taxonomy sync        | `packages/db/src/taxonomy/service.ts`, `apps/api/src/routes/taxonomy.ts` |
| List/filter queries  | `packages/db/src/query/index.ts`                                         |
| API routes           | `apps/api/src/routes/markets.ts`                                         |
| CLI commands         | `apps/cli/src/commands/`                                                 |
| Explorer UI          | `apps/ui/` (see `apps/ui/AGENTS.md`)                                     |
| Agent export         | `packages/db/src/export/index.ts`, `apps/api/src/routes/markets.ts`      |
| Provider registry    | `packages/core/src/providers/registry.ts`                                |

---

## Learned User Preferences

- Update `CHANGELOG.md` for notable changes under `[Unreleased]`; cut a **dated** release section when shipping (optional semver label in body; default patch bump `0.5.x` when tagging) — do not bump minor/major without explicit user approval.
- Before every **commit or push**, run `bun run format`, `bun run typecheck`, `bun run lint`, and `bun run test` — all must pass; never push if any check fails.
- When committing from mixed WIP, stage and push only files related to the current change; exclude unrelated work-in-progress.
- When directed to continue through the plan, loop autonomously through phases until MVP exit gates pass without pausing between phases for approval.
- Initial commits should document what changed (via CHANGELOG `[Unreleased]` entries and conventional commit messages).
- Version line stays at **0.5.x** (patch) until the user requests a minor (`0.6.0`) or major (`1.0.0`) bump.
- Mirror **applied.dev** visual/UX patterns (card lists, filters, detail sheets) when building or extending `apps/ui`.
- Keep Kalshi/API-sourced market and event titles in original casing; do not title-case card or sheet titles (breaks acronyms like BTC).
- When landing multi-topic work, split into **logical commits** by layer (provider, db, api, cli, ui, docs) rather than one monolithic commit.

---

## Learned Workspace Facts

- Repo bootstrapped at `/Users/tjeastmond/Projects/forecast-kit` with `Project_Plan.md` copied from sibling `forecastkit.dev`.
- GitHub repository is `tjeastmond/forecast-kit` (renamed from `forcast-kit`).
- GitHub Actions CI (`.github/workflows/ci.yml`) runs `format:check`, `typecheck`, `lint`, and `test` on push/PR to `main`, plus a separate **Build** job that runs `format:check`, `lint`, and `bun run build`.
- Post-MVP polish is complete; `.ai/handoff-remaining.md` lists done items and explicit out-of-scope work; track bugs in `.ai/issues.md`.
- Sibling design reference **applied.dev** lives at `/Users/tjeastmond/Projects/applied.dev` (Next.js 15, shadcn, card-based list UI).
