import type {
  AppConfig,
  FetchOptions,
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  PredictionMarketProvider,
  ProviderEventBatch,
  ProviderMarket,
} from '@forcast-kit/core';
import { logger } from '@forcast-kit/core';
import { KalshiClient } from './client.js';
import { normalizeEventWithMarkets, normalizeMarket, deriveBinarySides } from './normalizer.js';
import { kalshiEventSchema, kalshiMarketSchema } from './schemas.js';

export class KalshiProvider implements PredictionMarketProvider {
  readonly id = 'kalshi' as const;
  private readonly client: KalshiClient;

  constructor(config: Pick<AppConfig, 'KALSHI_API_BASE_URL' | 'SYNC_PAGE_LIMIT' | 'SYNC_REQUEST_DELAY_MS'>) {
    this.client = new KalshiClient({
      baseUrl: config.KALSHI_API_BASE_URL,
      pageLimit: config.SYNC_PAGE_LIMIT,
      requestDelayMs: config.SYNC_REQUEST_DELAY_MS,
    });
  }

  async *fetchOpenEvents(options?: FetchOptions): AsyncGenerator<ProviderEventBatch> {
    let cursor: string | undefined;
    let page = 0;

    do {
      page += 1;
      const response = await this.client.fetchEventsPage({
        status: options?.status ?? 'open',
        ...(options?.minUpdatedTs !== undefined ? { minUpdatedTs: options.minUpdatedTs } : {}),
        ...(options?.seriesTicker !== undefined ? { seriesTicker: options.seriesTicker } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
      });

      const events: NormalizedEvent[] = [];
      const markets: NormalizedMarket[] = [];
      const sides: (NormalizedMarketSide & { marketTicker: string })[] = [];

      for (const rawEvent of response.events) {
        const parsed = kalshiEventSchema.safeParse(rawEvent);
        if (!parsed.success) {
          logger.warn({
            component: 'kalshi-provider',
            msg: 'skipping invalid event',
            error: parsed.error.message,
          });
          continue;
        }

        const normalized = normalizeEventWithMarkets(parsed.data);
        events.push(...normalized.events);
        markets.push(...normalized.markets);
        sides.push(...normalized.sides);
      }

      logger.info({
        component: 'kalshi-provider',
        msg: 'page fetched',
        page,
        events: events.length,
        markets: markets.length,
      });

      yield { events, markets, sides };

      if (options?.maxPages !== undefined && page >= options.maxPages) {
        break;
      }

      cursor = response.cursor ?? undefined;
      if (cursor) {
        await this.client.delayBetweenPages();
      }
    } while (cursor);
  }

  async fetchEvent(eventTicker: string): Promise<ProviderEventBatch | null> {
    const response = await this.client.fetchEvent(eventTicker);
    if (!response) {
      return null;
    }

    const parsed = kalshiEventSchema.safeParse(response.event);
    if (!parsed.success) {
      logger.warn({
        component: 'kalshi-provider',
        msg: 'invalid event payload',
        eventTicker,
        error: parsed.error.message,
      });
      return null;
    }

    const normalized = normalizeEventWithMarkets(parsed.data);
    logger.info({
      component: 'kalshi-provider',
      msg: 'event fetched',
      eventTicker,
      markets: normalized.markets.length,
    });

    return normalized;
  }

  async fetchMarket(ticker: string): Promise<ProviderMarket | null> {
    const raw = await this.client.fetchMarket(ticker);
    if (!raw) {
      return null;
    }

    const parsed = kalshiMarketSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({
        component: 'kalshi-provider',
        msg: 'invalid market payload',
        ticker,
        error: parsed.error.message,
      });
      return null;
    }

    const eventStub = kalshiEventSchema.parse({
      event_ticker: parsed.data.event_ticker,
      series_ticker: parsed.data.event_ticker.split('-')[0] ?? parsed.data.event_ticker,
      title: parsed.data.title,
    });

    const market = normalizeMarket(parsed.data, eventStub);
    const sides = market.marketType === 'binary' ? deriveBinarySides(market) : [];

    return { market, sides };
  }
}
