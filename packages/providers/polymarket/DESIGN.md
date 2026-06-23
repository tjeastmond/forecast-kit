# Polymarket field mapping (design)

Phase 5 stub — documents how Polymarket API responses will map into forecast-kit domain models when implementation begins.

## Provider identity

| Field              | Polymarket source                       | Normalized   |
| ------------------ | --------------------------------------- | ------------ |
| `provider`         | —                                       | `polymarket` |
| `externalMarketId` | `condition_id` or `market_slug`         | string       |
| `ticker`           | `slug` or synthetic `{event}-{outcome}` | string       |

## Events

Polymarket groups markets under **events** (questions) with one or more **outcomes** (markets).

| Normalized field    | Polymarket source            | Notes                  |
| ------------------- | ---------------------------- | ---------------------- |
| `eventTicker`       | `event.slug` or `event.id`   | Stable slug preferred  |
| `seriesTicker`      | prefix of slug or `category` | For focus rules        |
| `title`             | `event.title`                |                        |
| `category`          | `event.category` or tags     | Map to focus via rules |
| `settlementSources` | `resolutionSource`           | Array of URLs          |

## Markets (outcomes)

| Normalized field | Polymarket source                | Notes                                           |
| ---------------- | -------------------------------- | ----------------------------------------------- |
| `marketType`     | outcome count                    | `binary` when two outcomes; `scalar` for ranges |
| `status`         | `active` / `closed` / `resolved` | Map to `open` / `closed` / `settled`            |
| `closeTime`      | `endDate`                        | ISO datetime                                    |
| `volume`         | `volume`                         | USD volume                                      |
| `liquidity`      | `liquidity`                      | AMM pool depth                                  |
| `lastPrice`      | `outcomePrices[0]` or mid        | Implied probability 0–1                         |

## Sides

Binary markets expose YES/NO tokens:

| Side | Polymarket                   | Normalized |
| ---- | ---------------------------- | ---------- |
| Yes  | `outcomes[0]` / first token  | `yes`      |
| No   | `outcomes[1]` / second token | `no`       |

Scalar / multi-outcome markets may require one row per outcome with `side` = outcome label until a richer model is needed.

## Sync strategy

1. Paginate `/events` or GraphQL equivalent with `min_updated_ts` watermark (aligned with Kalshi incremental sync).
2. Normalize each active market; derive focus tags from category + keywords in title/rules.
3. Upsert through shared repositories; mark stale on full sync only.

## Open questions

- **Authentication**: CLOB vs gamma API — confirm public endpoints for read-only sync.
- **Rate limits**: Backoff parity with Kalshi `SYNC_REQUEST_DELAY_MS`.
- **Cross-provider tickers**: Query layer already keys on `(provider, ticker)` — no collision.

## Exit gate (Phase 5)

- `PolymarketProvider` stub compiles and registers in `ProviderRegistry`.
- This design doc exists before live API integration (Phase 6+).
