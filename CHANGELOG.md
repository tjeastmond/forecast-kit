# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Release policy (post-MVP):** Current line is **0.5.0**. Accumulate work under `[Unreleased]`, then cut a **dated** release section (`## [YYYY-MM-DD]` for the first release that day; `## [YYYY-MM-DD] 2`, `## [YYYY-MM-DD] 3`, … for additional same-day releases). Optional semver labels (e.g. `Release 0.5.0`) may appear in the section body for reference. Default semver bumps remain **patch** only (`0.5.x`). Do not tag a new minor version per phase, milestone, or commit. Bump **minor** (`0.6.0`) or **major / 1.0.0** only when explicitly requested.

## [Unreleased]

### Added

- GitHub Actions **Build** job (`format:check`, `lint`, `typecheck`, `ui:build`) on push to `main` and pull requests
- MIT License (`LICENSE`) at repo root

## [2026-06-23]

Post-MVP polish: explorer UI, Kalshi taxonomy sync, CLI/API filter parity, and focus-rule fixes.

### Changed

- Explorer market detail sheet is read-only; admin edit form removed from the UI (API admin routes unchanged)
- Event detail market cards show Yes and No implied percentages derived from API metrics or pricing fields
- Explorer UI theme choice (light/dark) persists in `localStorage` under `forecast-kit-theme`, restored before first paint, and synced to a cookie for SSR; migrates prior `forcast-kit-theme` values
- Explorer event detail markets sort by implied payout likelihood (highest first), with shared comparator in `apps/ui/src/lib/sort-markets.ts`
- Explorer filter layout: row 1 is Focus and Category (50/50); row 2 is Tag and Status with matching widths; Exclude Focus and Stale Only removed from explorer filters (API/CLI unchanged)
- Focus derivation uses synced Kalshi series metadata (`category`, `tags`) instead of hardcoded category strings in `rules.json`
- Explorer events list persists filters, page size, and cursor position in the URL; page-size preference also syncs to `localStorage`, list results cache in memory for back navigation, and the event detail back link restores the prior list query
- Explorer shell content width increased 25% (`60rem`)
- Explorer default route and nav prioritize `/events`; event detail shows market cards instead of comparison table
- `bun run ui` now starts the API server and explorer UI together; use `bun run ui:app` for UI only
- UI defaults to same-origin `/api` proxy (avoids CORS); API CORS preflight fixed via `@fastify/cors`
- `Project_Plan.md` milestone checkboxes marked complete for Phases 1–5
- Drizzle migration snapshot chain completed for `0001_add_market_stale`

### Fixed

- Explorer UI dev scripts (`bun run ui:app`, `@forecast-kit/ui` `dev`) now remove stale `.next` before starting Next.js, matching `bun run ui` and avoiding missing webpack chunk errors (e.g. `Cannot find module './26.js'`) after large UI refactors
- Explorer events list no longer throws intermittent `TypeError: a[d] is not a function` on `/events`: page is a Server Component with Suspense around the client list, filter helpers import from `@/lib/marketFilters` (not re-exported through a client component), and stored page size reads use `useSyncExternalStore` to avoid SSR/hydration mismatch
- Explorer events list no longer hits a maximum update depth error when restoring cached pagination state
- Explorer UI build resolves `@forecast-kit/core/metrics` via subpath export and `transpilePackages` (avoids webpack failing on core barrel `.js` re-exports)
- Explorer event detail sync no longer flashes a loading state or re-renders unchanged market cards after refresh
- Incremental sync missed live Kalshi mention markets (e.g. `KXTRUMPMENTION-26JUN23`) when Kalshi reports a stale `last_updated_ts`; incremental runs now include a targeted Mentions series discovery pass
- `mentions` focus rules now match Kalshi category `Mentions` and series prefixes such as `KXTRUMPMENTION` (not only `KXMENTION`)
- Focus keyword matching uses word boundaries so `AI` no longer false-positives on "Chair"
- Kalshi sync accepts settlement sources with missing or empty `name` fields

### Added

- Kalshi taxonomy sync: `GET /search/tags_by_categories` and `GET /series` fetched into SQLite (`provider_categories`, `provider_category_tags`, `provider_series`); refreshed at the start of each market sync and via `POST /sync/taxonomy`
- `GET /taxonomy` and `GET /taxonomy/series` read APIs for dynamic category/tag dropdowns
- Market and event list filters: `?category=` and `?tag=` (CLI: `--category`, `--tag`)
- Research focus labels `politicians` and `mentions` with series-prefix/keyword rules
- Scheduled refresh recipe (external cron): `POST /sync/taxonomy` then `POST /sync` every 6h
- `POST /events/:eventTicker/sync` to refresh a single event and its markets from Kalshi
- Event detail page sync button and events-first explorer navigation (events → markets → detail sheet)
- Kalshi market `yes_sub_title` mapped to `subtitle` for short per-outcome labels (e.g. mention markets)
- CLI `--full` flag for full sync with stale-market marking (parity with `POST /sync`)
- CLI `events` command to list events and show event detail with filtered markets
- CLI sync resolves providers via `ProviderRegistry` (same pattern as API)
- CLI argument-parsing tests and API/CLI list parity integration test
- `apps/ui` local explorer: lean market/event cards, detail sheet, event comparison table, focused admin edits, sync dialog
- API admin routes (`PATCH /admin/markets/:ticker`, `PUT /admin/markets/:ticker/focus-tags`), stale filter, `GET /sync` list, CORS for UI dev

## [2026-06-22] 5

Release 0.5.0 — Phase 5 multi-provider foundation.

### Added

- **Phase 5 — Multi-provider foundation**
  - `ProviderRegistry` for registering Kalshi and Polymarket providers
  - API `POST /sync` resolves provider via registry (`kalshi`, `polymarket` stub)
  - Polymarket field-mapping design doc (`packages/providers/polymarket/DESIGN.md`)
  - GitHub Actions CI workflow (typecheck, lint, test)

## [2026-06-22] 4

Release 0.4.0 — Phase 4 agent export.

### Added

- **Phase 4 — Agent export**
  - `GET /markets/:ticker/export` stable JSON schema v1.0 for LLM context
  - Derived metrics: spread, mid price, implied probability
  - Incremental sync via `min_updated_ts` from last successful run
  - `is_stale` column and stale-market flagging on full sync (`--full` / `full: true`)

## [2026-06-22] 3

Release 0.3.0 — Phase 3 query and filter.

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

## [2026-06-22] 2

Release 0.2.0 — Phase 2 Kalshi sync.

### Added

- **Phase 2 — Kalshi sync**
  - `KalshiProvider` with paginated `/events` fetch, Zod validation, retry/backoff, and rate-limit handling
  - Kalshi → domain normalizer with binary YES/NO side derivation
  - Drizzle repositories for events, markets, market sides, and sync runs (idempotent upserts)
  - `SyncService` orchestrating provider fetch → DB persistence with audit trail
  - CLI `sync kalshi` command wired end-to-end (`--max-pages` for dev/testing)
  - Golden fixture and unit tests for normalizer, parse-decimal, repositories, and sync service

## [2026-06-22]

Release 0.1.0 — Phase 1 monorepo scaffold.

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
