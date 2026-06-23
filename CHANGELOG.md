# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Version policy (post-MVP):** Current line is **0.5.0**. Accumulate work under `[Unreleased]`. Default release bumps are **patch** only (`0.5.x`). Do not tag a new minor version per phase, milestone, or commit. Bump **minor** (`0.6.0`) or **major / 1.0.0** only when explicitly requested.

## [Unreleased]

### Added

- CLI `--full` flag for full sync with stale-market marking (parity with `POST /sync`)
- CLI `events` command to list events and show event detail with filtered markets
- CLI sync resolves providers via `ProviderRegistry` (same pattern as API)
- CLI argument-parsing tests and API/CLI list parity integration test
- `apps/ui` local explorer: lean market/event cards, detail sheet, event comparison table, focused admin edits, sync dialog
- API admin routes (`PATCH /admin/markets/:ticker`, `PUT /admin/markets/:ticker/focus-tags`), stale filter, `GET /sync` list, CORS for UI dev

### Fixed

- Focus keyword matching uses word boundaries so `AI` no longer false-positives on "Chair"

### Changed

- `bun run ui` now starts the API server and explorer UI together; use `bun run ui:app` for UI only
- UI defaults to same-origin `/api` proxy (avoids CORS); API CORS preflight fixed via `@fastify/cors`
- `Project_Plan.md` milestone checkboxes marked complete for Phases 1–5
- Drizzle migration snapshot chain completed for `0001_add_market_stale`

## [0.5.0] - 2026-06-22

### Added

- **Phase 5 — Multi-provider foundation**
  - `ProviderRegistry` for registering Kalshi and Polymarket providers
  - API `POST /sync` resolves provider via registry (`kalshi`, `polymarket` stub)
  - Polymarket field-mapping design doc (`packages/providers/polymarket/DESIGN.md`)
  - GitHub Actions CI workflow (typecheck, lint, test)

## [0.4.0] - 2026-06-22

### Added

- **Phase 4 — Agent export**
  - `GET /markets/:ticker/export` stable JSON schema v1.0 for LLM context
  - Derived metrics: spread, mid price, implied probability
  - Incremental sync via `min_updated_ts` from last successful run
  - `is_stale` column and stale-market flagging on full sync (`--full` / `full: true`)

## [0.3.0] - 2026-06-22

### Added

- **Phase 3 — Query & filter**
  - Focus tagging rules (`rules.json`) with category, series prefix, and keyword matching
  - Focus/exclude filtering on sync, `list`, and API endpoints
  - `MarketQueryService` and `EventQueryService` with cursor pagination
  - API: `GET /markets`, `GET /markets/:ticker`, `GET /events`, `GET /events/:eventTicker`
  - API: `POST /sync`, `GET /sync/:id`
  - CLI: `list` and `inspect` commands; Ink sync progress UI
  - Integration tests for query layer and API market routes
- **`AGENTS.md`** — agent handoff guide with scripts, directory structure, and architecture

## [0.2.0] - 2026-06-22

### Added

- **Phase 2 — Kalshi sync**
  - `KalshiProvider` with paginated `/events` fetch, Zod validation, retry/backoff, and rate-limit handling
  - Kalshi → domain normalizer with binary YES/NO side derivation
  - Drizzle repositories for events, markets, market sides, and sync runs (idempotent upserts)
  - `SyncService` orchestrating provider fetch → DB persistence with audit trail
  - CLI `sync kalshi` command wired end-to-end (`--max-pages` for dev/testing)
  - Golden fixture and unit tests for normalizer, parse-decimal, repositories, and sync service

## [0.1.0] - 2026-06-22

### Added

- **Monorepo scaffold (Phase 1)** — Bun workspace with `apps/cli`, `apps/api`, and shared packages under `packages/`.
- **`packages/core`** — Domain types (`NormalizedEvent`, `NormalizedMarket`, `NormalizedMarketSide`), `Focus` enum, Zod-based config loader, and structured JSON logger.
- **`packages/db`** — Drizzle ORM schema for `events`, `markets`, `market_sides`, `market_focus_tags`, and `sync_runs`; initial migration; Bun SQLite client; repository stubs for Phase 2.
- **`packages/providers/kalshi`** and **`packages/providers/polymarket`** — Provider interface stubs implementing `PredictionMarketProvider`.
- **`apps/api`** — Fastify server with `GET /health` returning database connection status.
- **`apps/cli`** — Ink-based CLI shell with command router for `sync`, `list`, `inspect`, and `serve` (stub commands except `serve` and `--help`).
- **Tooling** — Strict TypeScript (`tsconfig.base.json`), ESLint, Prettier, Vitest, and Drizzle Kit.
- **Configuration** — `.env.example` with database path, API host/port, Kalshi API settings, and sync tuning variables.
- **`Project_Plan.md`** — Full MVP architecture, schema, API/CLI contracts, and phased implementation plan.
