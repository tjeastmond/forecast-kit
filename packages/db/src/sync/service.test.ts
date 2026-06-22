import type {
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  PredictionMarketProvider,
  ProviderEventBatch,
} from '@forcast-kit/core';
import { count, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createRepositories } from '../repositories/index.js';
import { markets } from '../schema/index.js';
import { createSyncService } from '../sync/service.js';
import { createTestDatabase } from '../test-utils.js';

const sampleEvent: NormalizedEvent = {
  provider: 'kalshi',
  externalEventId: 'TEST-EVENT',
  eventTicker: 'TEST-EVENT',
  seriesTicker: 'TEST',
  title: 'Test event',
  subtitle: 'Subtitle',
  category: 'Politics',
  settlementSources: ['Reuters'],
  rawJson: { event_ticker: 'TEST-EVENT' },
};

const sampleMarket: NormalizedMarket = {
  provider: 'kalshi',
  externalMarketId: 'TEST-MARKET',
  ticker: 'TEST-MARKET',
  eventTicker: 'TEST-EVENT',
  seriesTicker: 'TEST',
  title: 'Test market?',
  subtitle: '',
  category: 'Politics',
  marketType: 'binary',
  status: 'active',
  openTime: new Date('2025-01-01T00:00:00Z'),
  closeTime: new Date('2026-01-01T00:00:00Z'),
  expirationTime: null,
  volume: 100,
  volume24h: 10,
  liquidity: 5,
  openInterest: 50,
  yesBid: 0.4,
  yesAsk: 0.42,
  noBid: 0.58,
  noAsk: 0.6,
  lastPrice: 0.41,
  rulesPrimary: 'Test rules',
  rulesSecondary: null,
  rawJson: { ticker: 'TEST-MARKET' },
};

const sampleSides: (NormalizedMarketSide & { marketTicker: string })[] = [
  {
    provider: 'kalshi',
    marketTicker: 'TEST-MARKET',
    label: 'Yes',
    side: 'yes',
    bid: 0.4,
    ask: 0.42,
    price: 0.41,
    investable: true,
    rawJson: { side: 'yes' },
  },
  {
    provider: 'kalshi',
    marketTicker: 'TEST-MARKET',
    label: 'No',
    side: 'no',
    bid: 0.58,
    ask: 0.6,
    price: 0.59,
    investable: true,
    rawJson: { side: 'no' },
  },
];

const sampleBatch: ProviderEventBatch = {
  events: [sampleEvent],
  markets: [sampleMarket],
  sides: sampleSides,
};

/* eslint-disable @typescript-eslint/require-await -- mock provider */
class MockProvider implements PredictionMarketProvider {
  readonly id = 'kalshi' as const;

  async *fetchOpenEvents(): AsyncGenerator<ProviderEventBatch> {
    yield sampleBatch;
  }

  fetchMarket(): Promise<null> {
    return Promise.resolve(null);
  }
}

describe('SyncService', () => {
  it('persists events and markets from a provider batch', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);
    const provider = new MockProvider();

    const result = await syncService.syncProvider(provider);

    expect(result.status).toBe('success');
    expect(result.eventsUpserted).toBe(1);
    expect(result.marketsUpserted).toBe(1);

    const [marketCount] = await db.select({ value: count() }).from(markets);
    expect(marketCount?.value).toBe(1);
  });

  it('upserts idempotently on repeated sync', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);
    const provider = new MockProvider();

    await syncService.syncProvider(provider);
    await syncService.syncProvider(provider);

    const [marketCount] = await db.select({ value: count() }).from(markets);
    expect(marketCount?.value).toBe(1);
  });
});

describe('EventRepository', () => {
  it('upserts and returns event id', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);

    const id = await repos.events.upsert(sampleEvent);
    const idAgain = await repos.events.upsert(sampleEvent);

    expect(id).toBeGreaterThan(0);
    expect(idAgain).toBe(id);
  });
});

describe('MarketRepository', () => {
  it('upserts market by provider ticker', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);

    const id = await repos.markets.upsert(sampleMarket);
    expect(id).toBeGreaterThan(0);

    const rows = await db.select().from(markets).where(eq(markets.ticker, sampleMarket.ticker));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe(sampleMarket.title);
  });
});
