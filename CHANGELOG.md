# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
