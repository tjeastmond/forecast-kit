import { logger } from '@forcast-kit/core';
import {
  kalshiEventsResponseSchema,
  kalshiMarketResponseSchema,
  type KalshiEventsResponse,
  type KalshiMarket,
} from './schemas.js';

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 500;

export interface KalshiClientConfig {
  readonly baseUrl: string;
  readonly pageLimit: number;
  readonly requestDelayMs: number;
}

export interface FetchEventsPageParams {
  readonly cursor?: string;
  readonly status?: 'open' | 'closed' | 'settled';
  readonly minUpdatedTs?: number;
  readonly seriesTicker?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

export class KalshiClient {
  constructor(private readonly config: KalshiClientConfig) {}

  async fetchEventsPage(params: FetchEventsPageParams): Promise<KalshiEventsResponse> {
    const url = new URL(`${this.config.baseUrl}/events`);
    url.searchParams.set('with_nested_markets', 'true');
    url.searchParams.set('limit', String(this.config.pageLimit));
    url.searchParams.set('status', params.status ?? 'open');

    if (params.cursor) {
      url.searchParams.set('cursor', params.cursor);
    }
    if (params.minUpdatedTs !== undefined) {
      url.searchParams.set('min_updated_ts', String(params.minUpdatedTs));
    }
    if (params.seriesTicker) {
      url.searchParams.set('series_ticker', params.seriesTicker);
    }

    const json: unknown = await this.requestJson(url);
    return kalshiEventsResponseSchema.parse(json);
  }

  async fetchMarket(ticker: string): Promise<KalshiMarket | null> {
    const url = new URL(`${this.config.baseUrl}/markets/${encodeURIComponent(ticker)}`);
    try {
      const json: unknown = await this.requestJson(url);
      const parsed = kalshiMarketResponseSchema.parse(json);
      return parsed.market;
    } catch (error) {
      if (error instanceof KalshiNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  async delayBetweenPages(): Promise<void> {
    if (this.config.requestDelayMs > 0) {
      await sleep(this.config.requestDelayMs);
    }
  }

  private async requestJson(url: URL): Promise<unknown> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });

        if (response.status === 404) {
          throw new KalshiNotFoundError(url.toString());
        }

        if (response.status === 429 || response.status >= 500) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          const backoffMs = retryAfterMs ?? BASE_BACKOFF_MS * 2 ** attempt;
          logger.warn({
            component: 'kalshi-client',
            msg: 'transient HTTP error, retrying',
            status: response.status,
            attempt: attempt + 1,
            backoffMs,
          });
          await sleep(backoffMs);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Kalshi API error ${String(response.status)}: ${await response.text()}`);
        }

        return await response.json();
      } catch (error) {
        if (error instanceof KalshiNotFoundError) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
          logger.warn({
            component: 'kalshi-client',
            msg: 'request failed, retrying',
            attempt: attempt + 1,
            backoffMs,
            error: lastError.message,
          });
          await sleep(backoffMs);
        }
      }
    }

    throw lastError ?? new Error('Kalshi request failed');
  }
}

export class KalshiNotFoundError extends Error {
  constructor(url: string) {
    super(`Kalshi resource not found: ${url}`);
    this.name = 'KalshiNotFoundError';
  }
}
