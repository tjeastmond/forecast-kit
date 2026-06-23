# forecast-kit

## Goal

Build a strict TypeScript backend and Ink CLI that:

1. Fetches open Kalshi markets and events.
2. Stores complete market metadata, event metadata, pricing, and investable sides in SQLite.
3. Filters by focus areas such as politics, weather, economics, technology, and more.
4. Exposes local API endpoints and CLI commands that other agents can consume.
5. Remains provider-agnostic so Polymarket can be added later without redesigning the system.

### Non-goals (MVP)

- Trading, order placement, or portfolio management.
- Real-time WebSocket price streaming (deferred; polling sync only).
- Prediction or research logic (lives in downstream agents).
- Multi-user auth or hosted deployment.

### Definition of done (MVP)

The MVP is complete when the [First Success Criteria](#first-success-criteria) commands succeed on a clean checkout, the local database contains normalized Kalshi data with focus tags, and both CLI and API return consistent results for the same filters.

---

## Tech Stack

| Layer         | Choice                    |
| ------------- | ------------------------- |
| Runtime       | Bun                       |
| Language      | TypeScript (strict)       |
| Database      | SQLite (local file)       |
| ORM           | Drizzle ORM + drizzle-kit |
| CLI UI        | Ink (React for terminal)  |
| HTTP API      | Fastify                   |
| Validation    | Zod                       |
| Testing       | Vitest                    |
| Lint / format | ESLint + Prettier         |

---

## Repository Structure

```txt
forecast-kit/
  apps/
    cli/                  # Ink TUI + command router
      src/
        index.tsx
        commands/
    api/                  # Fastify server
      src/
        index.ts
        routes/

  packages/
    core/                 # Domain types, focus tagging, config, logging
      src/
        types/
        focus/
        config/
    db/                   # Drizzle schema, migrations, repositories
      src/
        schema/
        repositories/
    providers/
      kalshi/             # Kalshi HTTP client + normalizer
        src/
      polymarket/         # Stub only until Phase 5

  .env.example
  package.json            # Bun workspaces root
  tsconfig.base.json
  eslint.config.js
  prettier.config.js
  bun.lock
  drizzle.config.ts
```

Single repository, shared packages, one lockfile. Package dependency flow:

```txt
apps/cli, apps/api  →  db, providers/*  →  core
providers/kalshi    →  core
providers/polymarket → core (stub)
```

---

## Architecture

```txt
Kalshi REST API
      ↓
KalshiProvider (fetch + paginate + validate)
      ↓
Normalizer → internal Event / Market / MarketSide models
      ↓
SyncService (upsert + focus tagging + raw payload retention)
      ↓
SQLite (Drizzle)
      ↓
┌─────────────┬──────────────┐
│  Fastify    │  Ink CLI     │
│  /markets   │  sync, list  │
│  /events    │  inspect     │
└─────────────┴──────────────┘
      ↓
Future Research Agent
```

forecast-kit is responsible for:

- Fetching and paginating market data
- Normalizing provider-specific field names and types
- Persisting data with raw payload retention
- Tagging focus categories
- Serving filtered, agent-ready data locally

Research and prediction logic live outside forecast-kit.

---

## Configuration

Environment variables (see `.env.example`):

| Variable                  | Required | Default                                        | Purpose                                                                                                           |
| ------------------------- | -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `FORECAST_KIT_DB_PATH`    | No       | `./data/forecast-kit.db`                       | SQLite file location                                                                                              |
| `FORECAST_KIT_API_HOST`   | No       | `127.0.0.1`                                    | API bind host                                                                                                     |
| `FORECAST_KIT_API_PORT`   | No       | `3847`                                         | API bind port                                                                                                     |
| `KALSHI_API_BASE_URL`     | No       | `https://external-api.kalshi.com/trade-api/v2` | Kalshi REST base (`external-api` hosts are recommended; demo: `https://external-api.demo.kalshi.co/trade-api/v2`) |
| `KALSHI_API_KEY_ID`       | No       | —                                              | Only needed for authenticated endpoints                                                                           |
| `KALSHI_PRIVATE_KEY_PATH` | No       | —                                              | PEM path for RSA-PSS signing                                                                                      |
| `SYNC_PAGE_LIMIT`         | No       | `200`                                          | Max records per Kalshi page (API max: 200)                                                                        |
| `SYNC_REQUEST_DELAY_MS`   | No       | `100`                                          | Delay between paginated requests                                                                                  |

**Auth note:** Open market and event endpoints are publicly readable without credentials. Authenticated keys are optional for MVP sync and required only if future features call protected endpoints (orders, portfolio, higher rate tiers).

---

## Provider Abstraction

### Interface

```ts
export interface PredictionMarketProvider {
  readonly id: ProviderId; // 'kalshi' | 'polymarket'

  /** Fetch all open events (with nested markets where supported). */
  fetchOpenEvents(options?: FetchOptions): AsyncGenerator<ProviderEventBatch>;

  /** Fetch a single market by provider ticker. */
  fetchMarket(ticker: string): Promise<ProviderMarket | null>;
}

export interface FetchOptions {
  readonly status?: 'open' | 'closed' | 'settled';
  readonly seriesTicker?: string;
  readonly minUpdatedTs?: number; // incremental sync watermark
}
```

### Implementations

| Provider             | Phase | Notes                                                     |
| -------------------- | ----- | --------------------------------------------------------- |
| `KalshiProvider`     | 2     | Primary MVP integration                                   |
| `PolymarketProvider` | 5     | Stub interface + `NotImplemented` until API client exists |

Everything downstream consumes **normalized** domain objects from `packages/core`, never raw Kalshi shapes.

---

## Kalshi Integration (MVP)

### Endpoints used

| Endpoint                                                              | Purpose                           |
| --------------------------------------------------------------------- | --------------------------------- |
| `GET /events?status=open&with_nested_markets=true&limit=200&cursor=…` | Primary bulk sync path            |
| `GET /events/{event_ticker}`                                          | Event detail backfill             |
| `GET /markets/{ticker}`                                               | Single market refresh             |
| `GET /events/multivariate?…`                                          | Optional: combo events (Phase 3+) |

Base URL: `https://external-api.kalshi.com/trade-api/v2` (production, recommended). Demo: `https://external-api.demo.kalshi.co/trade-api/v2`. Alternate production host `https://api.elections.kalshi.com/trade-api/v2` also works.

### Pagination

Kalshi returns a `cursor` string; repeat requests until `cursor` is empty. Use `limit=200` (API maximum). Implement cursor loop in `KalshiProvider.fetchOpenEvents`.

### Field mapping (Kalshi → internal)

Kalshi uses dollar-denominated fixed-point strings (`yes_bid_dollars`, `volume_fp`, etc.). Normalize to:

| Internal field | Kalshi source        | Transform                 |
| -------------- | -------------------- | ------------------------- |
| `yesBid`       | `yes_bid_dollars`    | `parseDecimal()` → number |
| `yesAsk`       | `yes_ask_dollars`    | same                      |
| `noBid`        | `no_bid_dollars`     | same                      |
| `noAsk`        | `no_ask_dollars`     | same                      |
| `lastPrice`    | `last_price_dollars` | same                      |
| `volume`       | `volume_fp`          | same                      |
| `volume24h`    | `volume_24h_fp`      | same                      |
| `openInterest` | `open_interest_fp`   | same                      |
| `liquidity`    | `liquidity_dollars`  | same                      |
| `status`       | `status`             | map to internal enum      |
| `marketType`   | `market_type`        | `'binary' \| 'scalar'`    |

Store the full provider payload in `raw_json` unchanged.

### Resilience

- Retry transient failures (429, 5xx) with exponential backoff (base 500 ms, max 5 retries).
- Respect `Retry-After` header when present.
- Log and skip individual records that fail Zod validation; do not abort the entire sync.
- Record sync run metadata (see `sync_runs` table).

---

## Domain Models (`packages/core`)

```ts
export type Focus = 'politics' | 'weather' | 'economics' | 'technology' | 'crypto' | 'entertainment' | 'sports';

export type ProviderId = 'kalshi' | 'polymarket';

export interface NormalizedEvent {
  provider: ProviderId;
  externalEventId: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  category: string | null;
  settlementSources: readonly string[];
  rawJson: unknown;
}

export interface NormalizedMarket {
  provider: ProviderId;
  externalMarketId: string;
  ticker: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  category: string | null;
  marketType: 'binary' | 'scalar';
  status: MarketStatus;
  openTime: Date;
  closeTime: Date;
  expirationTime: Date | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  lastPrice: number | null;
  rulesPrimary: string | null;
  rulesSecondary: string | null;
  rawJson: unknown;
}

/** Investable side for binary markets (YES / NO) or scalar outcomes. */
export interface NormalizedMarketSide {
  provider: ProviderId;
  label: string; // e.g. "Yes", "No", or scalar outcome label
  side: 'yes' | 'no' | 'other';
  bid: number | null;
  ask: number | null;
  price: number | null; // last traded or mid
  investable: boolean; // false when market closed or no quotes
  rawJson: unknown;
}
```

---

## Database Schema

All tables use integer primary keys. Unique constraints prevent duplicate provider records.

### `events`

| Column                    | Type          | Notes                 |
| ------------------------- | ------------- | --------------------- |
| `id`                      | integer PK    |                       |
| `provider`                | text          | `'kalshi'`            |
| `external_event_id`       | text          | Provider-stable ID    |
| `event_ticker`            | text          |                       |
| `series_ticker`           | text          |                       |
| `title`                   | text          |                       |
| `subtitle`                | text          |                       |
| `category`                | text nullable |                       |
| `settlement_sources_json` | text          | JSON array            |
| `raw_json`                | text          | Full provider payload |
| `created_at`              | text          | ISO timestamp         |
| `updated_at`              | text          |                       |
| `last_seen_at`            | text          | Updated each sync     |

**Indexes:** unique `(provider, event_ticker)`; index on `category`.

### `markets`

| Column               | Type             | Notes                  |
| -------------------- | ---------------- | ---------------------- |
| `id`                 | integer PK       |                        |
| `provider`           | text             |                        |
| `external_market_id` | text             |                        |
| `ticker`             | text             |                        |
| `event_ticker`       | text FK → events |                        |
| `series_ticker`      | text             |                        |
| `title`              | text             |                        |
| `subtitle`           | text             |                        |
| `category`           | text nullable    |                        |
| `market_type`        | text             | `'binary' \| 'scalar'` |
| `status`             | text             | normalized lifecycle   |
| `close_time`         | text             |                        |
| `expiration_time`    | text nullable    |                        |
| `open_time`          | text             |                        |
| `volume`             | real             |                        |
| `volume_24h`         | real             |                        |
| `liquidity`          | real             |                        |
| `open_interest`      | real             |                        |
| `yes_bid`            | real nullable    |                        |
| `yes_ask`            | real nullable    |                        |
| `no_bid`             | real nullable    |                        |
| `no_ask`             | real nullable    |                        |
| `last_price`         | real nullable    |                        |
| `rules_primary`      | text nullable    | Agent-critical         |
| `rules_secondary`    | text nullable    |                        |
| `raw_json`           | text             |                        |
| `created_at`         | text             |                        |
| `updated_at`         | text             |                        |
| `last_seen_at`       | text             |                        |

**Indexes:** unique `(provider, ticker)`; index on `(status, close_time)`; index on `event_ticker`.

### `market_sides`

Replaces a generic "options" table. Binary Kalshi markets produce two rows (YES, NO).

| Column       | Type                 | Notes                      |
| ------------ | -------------------- | -------------------------- |
| `id`         | integer PK           |                            |
| `provider`   | text                 |                            |
| `market_id`  | integer FK → markets |                            |
| `label`      | text                 | Display label              |
| `side`       | text                 | `'yes' \| 'no' \| 'other'` |
| `bid`        | real nullable        |                            |
| `ask`        | real nullable        |                            |
| `price`      | real nullable        |                            |
| `investable` | boolean              |                            |
| `raw_json`   | text nullable        |                            |
| `created_at` | text                 |                            |
| `updated_at` | text                 |                            |

**Indexes:** unique `(market_id, side)`.

### `market_focus_tags`

| Column      | Type                 | Notes                      |
| ----------- | -------------------- | -------------------------- |
| `id`        | integer PK           |                            |
| `market_id` | integer FK → markets |                            |
| `focus`     | text                 | One of `Focus` enum values |

**Indexes:** unique `(market_id, focus)`; index on `focus`.

### `sync_runs`

Audit trail for sync operations.

| Column              | Type          | Notes                                             |
| ------------------- | ------------- | ------------------------------------------------- |
| `id`                | integer PK    |                                                   |
| `provider`          | text          |                                                   |
| `started_at`        | text          |                                                   |
| `finished_at`       | text nullable |                                                   |
| `status`            | text          | `'running' \| 'success' \| 'partial' \| 'failed'` |
| `events_upserted`   | integer       |                                                   |
| `markets_upserted`  | integer       |                                                   |
| `errors_count`      | integer       |                                                   |
| `focus_filter_json` | text nullable | Serialized include/exclude                        |
| `error_summary`     | text nullable |                                                   |

Raw payload storage ensures future provider fields can be recovered without another migration.

---

## Focus Tagging

Focus tags are derived at sync time from Kalshi `category`, `series_ticker`, and keyword rules in `packages/core/src/focus/rules.ts`.

### Mapping rules (initial)

| Focus           | Match conditions (any)                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| `politics`      | category contains "Politics", "Elections"; series prefix `KXPRES`, `KXGOV`, `KXELECT` |
| `weather`       | category "Climate and Weather"; series prefix `KXHIGH`, `KXLOW`, `KXRAIN`             |
| `economics`     | category "Economics", "Financials"; keywords: GDP, CPI, Fed, unemployment             |
| `technology`    | category "Science and Technology"; keywords: AI, Apple, Google, OpenAI                |
| `crypto`        | category "Crypto"; keywords: Bitcoin, Ethereum, BTC, ETH                              |
| `entertainment` | category "Entertainment"; keywords: Oscar, Grammy, box office                         |
| `sports`        | category "Sports"; milestone type sports\_\*                                          |

A market may have multiple focus tags. Rules are data-driven (JSON config) so they can be tuned without schema changes.

### CLI / sync filtering

- `--focus` → include only markets matching **any** listed focus (OR).
- `--exclude` → remove markets matching **any** listed focus.
- If both provided, apply include first, then exclude.

---

## Synchronization Flow

```txt
1. Create sync_run record (status: running)
2. Determine min_updated_ts from last successful sync (incremental) or full fetch
3. Paginate GET /events?status=open&with_nested_markets=true
4. For each event batch:
   a. Validate raw payload with Zod (KalshiEventSchema)
   b. Normalize → NormalizedEvent + NormalizedMarket[] + NormalizedMarketSide[]
   c. Derive focus tags
   d. Upsert event (on conflict update mutable fields + last_seen_at)
   e. Upsert markets and sides
   f. Replace focus tags for touched markets
5. Mark markets not seen in this run as stale (optional flag, not deleted)
6. Finalize sync_run (counts, status, errors)
```

Incremental sync uses Kalshi's `min_updated_ts` query parameter to reduce API volume after the first full sync.

---

## MVP API

Base URL: `http://127.0.0.1:3847`

All list endpoints support `?limit=` (default 50, max 200) and `?cursor=` (opaque local cursor).

### `GET /health`

Returns `{ "status": "ok", "db": "connected" }`.

### `GET /markets`

Query params:

| Param     | Type   | Description                             |
| --------- | ------ | --------------------------------------- |
| `focus`   | string | Comma-separated focus values (OR)       |
| `exclude` | string | Comma-separated focus values to exclude |
| `status`  | string | Filter by market status                 |
| `q`       | string | Title/ticker substring search           |
| `limit`   | number | Page size                               |
| `cursor`  | string | Pagination cursor                       |

Response: `{ markets: MarketSummary[], cursor: string | null }`.

### `GET /markets/:ticker`

Returns full market detail including sides, focus tags, event summary, and `raw_json`.

### `GET /events`

Same filtering as markets; returns events with nested market summaries when `?includeMarkets=true`.

### `GET /events/:eventTicker`

Event detail with all associated markets.

### `POST /sync`

Body (optional):

```json
{
  "provider": "kalshi",
  "focus": ["politics", "weather"],
  "exclude": ["sports"],
  "full": false
}
```

Triggers background sync; returns `{ "syncRunId": 1, "status": "running" }`.

### `GET /sync/:id`

Returns sync run status and counts.

---

## MVP CLI

```bash
forecast-kit sync kalshi [options]
forecast-kit list [options]
forecast-kit inspect <ticker>
forecast-kit serve [options]
```

### Examples

```bash
forecast-kit sync kalshi --focus politics
forecast-kit sync kalshi --focus weather,economics --exclude sports
forecast-kit list --focus politics --status open
forecast-kit inspect KXHIGHNY-25JUN22-T75
forecast-kit serve --port 3847
```

Ink renders sync progress (page count, records upserted, errors). Non-interactive mode (`--no-ui`) for scripts and CI.

---

## Agent Readiness

Each market record exposed to agents includes:

| Field                            | Source                                 |
| -------------------------------- | -------------------------------------- |
| Question / title                 | `markets.title`                        |
| Category                         | `markets.category`                     |
| Event metadata                   | joined `events` row                    |
| Close / expiration               | `close_time`, `expiration_time`        |
| Volume, liquidity, open interest | numeric columns                        |
| YES / NO bid-ask                 | `market_sides` or denormalized columns |
| Settlement rules                 | `rules_primary`, `rules_secondary`     |
| Focus tags                       | `market_focus_tags`                    |
| Raw payload                      | `raw_json` for forward compatibility   |

### Agent export (Phase 4)

`GET /markets/:ticker/export` returns a stable JSON document suitable for LLM context:

```json
{
  "schemaVersion": "1.0",
  "provider": "kalshi",
  "ticker": "…",
  "question": "…",
  "focusTags": ["politics"],
  "pricing": { "yesBid": 0.42, "yesAsk": 0.44, "noBid": 0.56, "noAsk": 0.58 },
  "liquidity": { "volume": 12500, "openInterest": 8200 },
  "timing": { "closeTime": "…", "expirationTime": "…" },
  "rules": { "primary": "…", "secondary": "…" },
  "event": { "ticker": "…", "title": "…" }
}
```

---

## TypeScript Standards

`tsconfig.base.json`:

- `strict: true`
- `noImplicitAny: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

ESLint rules:

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/consistent-type-imports`
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/prefer-readonly`

Use `satisfies` and discriminated unions for provider-specific payloads before normalization.

---

## Logging

Use structured JSON logs to stderr via a shared logger in `packages/core`:

```json
{ "level": "info", "component": "sync", "provider": "kalshi", "page": 3, "markets": 412, "msg": "page fetched" }
```

Log levels: `debug` (HTTP details), `info` (sync progress), `warn` (skipped records), `error` (failures). CLI `--verbose` sets `debug`; default is `info`.

---

## CI (minimal)

GitHub Actions workflow on push/PR:

```yaml
# .github/workflows/ci.yml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
```

No live Kalshi calls in CI — use fixtures only.

---

## Testing Strategy

| Layer        | What to test                           | Tool                      |
| ------------ | -------------------------------------- | ------------------------- |
| Normalizer   | Kalshi fixture JSON → domain models    | Vitest unit               |
| Focus rules  | Category/keyword → tag mapping         | Vitest unit               |
| Repositories | Upsert idempotency, unique constraints | Vitest + in-memory SQLite |
| SyncService  | End-to-end with mocked provider        | Vitest integration        |
| API routes   | Request/response contracts             | Vitest + Fastify inject   |
| CLI          | Argument parsing (no Ink render)       | Vitest unit               |

Commit golden fixtures under `packages/providers/kalshi/fixtures/` from real (redacted) API responses.

---

## Scripts

Root `package.json`:

```json
{
  "name": "forecast-kit",
  "workspaces": ["apps/*", "packages/*", "packages/providers/*"],
  "bin": {
    "forecast-kit": "./apps/cli/src/index.tsx"
  },
  "scripts": {
    "dev": "bun run apps/cli/src/index.tsx",
    "serve": "bun run apps/api/src/index.ts",
    "sync:kalshi": "bun run apps/cli/src/index.tsx sync kalshi --no-ui",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Milestones

Each phase has an **exit gate** — do not start the next phase until the gate passes.

### Phase 1 — Scaffold (exit gate: `bun run typecheck && bun run db:migrate` succeed)

- [x] Bun workspace monorepo with packages above
- [x] Strict TypeScript, ESLint, Prettier, Vitest wired
- [x] Drizzle schema for all tables + initial migration
- [x] Ink CLI shell with command router (stub commands)
- [x] Fastify API skeleton with `/health`
- [x] `.env.example` and config loader in `packages/core`

### Phase 2 — Kalshi sync (exit gate: sync stores ≥1 open market in SQLite)

- [x] `KalshiProvider` with pagination and Zod validation
- [x] Normalizer (Kalshi → domain models)
- [x] Repositories (upsert events, markets, sides)
- [x] `SyncService` with `sync_runs` audit
- [x] Retry/backoff for rate limits
- [x] Unit tests with fixtures

### Phase 3 — Query & filter (exit gate: First Success Criteria passes)

- [x] Focus tagging rules + `--focus` / `--exclude` on sync and list
- [x] CLI: `list`, `inspect`, sync progress UI
- [x] API: `/markets`, `/events`, `/markets/:ticker` with filters
- [x] `POST /sync` and `GET /sync/:id`
- [x] Integration tests for API + CLI parity

### Phase 4 — Agent export (exit gate: export JSON validates against schema)

- [x] `GET /markets/:ticker/export` stable schema v1.0
- [x] Derived metrics (spread, mid price, implied probability)
- [x] Incremental sync via `min_updated_ts`
- [x] Stale-market flagging for markets absent from latest sync

### Phase 5 — Multi-provider (exit gate: stub compiles; design doc for Polymarket mapping)

- [x] `PolymarketProvider` stub implementing interface
- [x] Provider registry in `SyncService`
- [x] Unified query layer (markets from any provider)
- [x] Polymarket field-mapping design (separate doc when started)

---

## Risks & Mitigations

| Risk                                      | Impact               | Mitigation                                                                   |
| ----------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| Kalshi API field renames / deprecation    | Normalizer breaks    | Store `raw_json`; version Zod schemas; fixture tests                         |
| Rate limiting (429)                       | Sync incomplete      | Backoff + `SYNC_REQUEST_DELAY_MS`; incremental sync                          |
| Large open-market volume                  | Slow first sync      | Pagination + progress UI; optional `series_ticker` filter                    |
| Focus rules misclassify markets           | Wrong agent inputs   | Rules in editable JSON; multiple tags allowed; manual override hook (future) |
| Binary vs scalar market shape differences | Missing sides        | `market_type` discriminator; side derivation per type                        |
| SQLite write contention                   | API slow during sync | Single-writer queue; sync runs sequentially                                  |

---

## First Success Criteria

```bash
bun install
cp .env.example .env
bun run db:migrate
bun run sync:kalshi -- --focus politics,weather --exclude sports
bun run serve
```

In a second terminal:

```bash
curl -s 'http://127.0.0.1:3847/markets?focus=politics&limit=5' | jq .
curl -s 'http://127.0.0.1:3847/markets/<ticker-from-above>' | jq .
bun run apps/cli/src/index.tsx list --focus politics
bun run apps/cli/src/index.tsx inspect <ticker-from-above>
```

The system should:

- Discover and paginate open Kalshi markets
- Store normalized events, markets, and sides locally with focus tags
- Return consistent filtered results via CLI and API
- Record sync run metadata
- Provide a clean, typed foundation for research and prediction agents
- Keep provider abstraction intact for future Polymarket integration

---

## Implementation Order (first session)

1. `bun init` workspace + `tsconfig.base.json` + ESLint/Prettier.
2. `packages/core` — config loader, domain types, focus enum.
3. `packages/db` — Drizzle schema, migration, repository stubs.
4. `apps/api` — Fastify `/health`.
5. `apps/cli` — Ink shell, command router, `--help`.
6. Verify: `bun run typecheck && bun run db:migrate && bun run serve` (health check).

This sequence unblocks all parallel work in Phase 2.
