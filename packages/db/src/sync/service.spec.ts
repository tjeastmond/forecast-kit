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
import { marketFocusTags, markets } from '../schema/index.js';
import { createSyncService } from '../sync/service.js';
import { createTestDatabase } from '../test-utils.js';

const sampleEvent: NormalizedEvent = {
  provider: 'kalshi',
  externalEventId: 'KXPRES-24',
  eventTicker: 'KXPRES-24',
  seriesTicker: 'KXPRES',
  title: '2024 Presidential Election',
  subtitle: 'Subtitle',
  category: 'Politics',
  settlementSources: ['Reuters'],
  rawJson: { event_ticker: 'KXPRES-24' },
};

const sampleMarket: NormalizedMarket = {
  provider: 'kalshi',
  externalMarketId: 'KXPRES-24-DEM',
  ticker: 'KXPRES-24-DEM',
  eventTicker: 'KXPRES-24',
  seriesTicker: 'KXPRES',
  title: 'Will a Democrat win the 2024 presidential election?',
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
  rawJson: { ticker: 'KXPRES-24-DEM' },
};

const sportsMarket: NormalizedMarket = {
  ...sampleMarket,
  externalMarketId: 'KXNBA-25-LAL',
  ticker: 'KXNBA-25-LAL',
  eventTicker: 'KXNBA-25',
  seriesTicker: 'KXNBA',
  title: 'Lakers win NBA title?',
  category: 'Sports',
  rawJson: { ticker: 'KXNBA-25-LAL' },
};

const sampleSides: (NormalizedMarketSide & { marketTicker: string })[] = [
  {
    provider: 'kalshi',
    marketTicker: 'KXPRES-24-DEM',
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
    marketTicker: 'KXPRES-24-DEM',
    label: 'No',
    side: 'no',
    bid: 0.58,
    ask: 0.6,
    price: 0.59,
    investable: true,
    rawJson: { side: 'no' },
  },
];

class MockProvider implements PredictionMarketProvider {
  readonly id = 'kalshi' as const;

  constructor(private readonly batch: ProviderEventBatch) {}

  /* eslint-disable @typescript-eslint/require-await -- mock provider */
  async *fetchOpenEvents(): AsyncGenerator<ProviderEventBatch> {
    yield this.batch;
  }

  fetchEvent(): Promise<ProviderEventBatch | null> {
    return Promise.resolve(this.batch);
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
    const provider = new MockProvider({
      events: [sampleEvent],
      markets: [sampleMarket],
      sides: sampleSides,
    });

    const result = await syncService.syncProvider(provider);

    expect(result.status).toBe('success');
    expect(result.eventsUpserted).toBe(1);
    expect(result.marketsUpserted).toBe(1);

    const [marketCount] = await db.select({ value: count() }).from(markets);
    expect(marketCount?.value).toBe(1);

    const tags = await db.select().from(marketFocusTags);
    expect(tags.some((row) => row.focus === 'politics')).toBe(true);
  });

  it('filters markets by focus during sync', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);
    const provider = new MockProvider({
      events: [sampleEvent, { ...sampleEvent, eventTicker: 'KXNBA-25', externalEventId: 'KXNBA-25' }],
      markets: [sampleMarket, sportsMarket],
      sides: sampleSides,
    });

    const result = await syncService.syncProvider(provider, { focus: ['politics'] });

    expect(result.marketsUpserted).toBe(1);
    const rows = await db.select().from(markets);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ticker).toBe('KXPRES-24-DEM');
  });

  it('upserts idempotently on repeated sync', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);
    const provider = new MockProvider({
      events: [sampleEvent],
      markets: [sampleMarket],
      sides: sampleSides,
    });

    await syncService.syncProvider(provider);
    await syncService.syncProvider(provider);

    const [marketCount] = await db.select({ value: count() }).from(markets);
    expect(marketCount?.value).toBe(1);
  });

  it('marks markets not seen in a full sync as stale', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);

    const oldMarket: NormalizedMarket = {
      ...sampleMarket,
      externalMarketId: 'OLD-MARKET',
      ticker: 'OLD-MARKET',
      title: 'Old market no longer returned',
    };

    await repos.markets.upsert(oldMarket);

    const provider = new MockProvider({
      events: [sampleEvent],
      markets: [sampleMarket],
      sides: sampleSides,
    });

    await syncService.syncProvider(provider, { full: true });

    const rows = await db.select().from(markets);
    const oldRow = rows.find((row) => row.ticker === 'OLD-MARKET');
    const currentRow = rows.find((row) => row.ticker === 'KXPRES-24-DEM');

    expect(oldRow?.isStale).toBe(true);
    expect(currentRow?.isStale).toBe(false);
  });

  it('syncs a single event and its markets without focus filtering', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const syncService = createSyncService(repos);
    const sportsOnSameEvent: NormalizedMarket = {
      ...sportsMarket,
      eventTicker: 'KXPRES-24',
      seriesTicker: 'KXPRES',
    };
    const provider = new MockProvider({
      events: [sampleEvent],
      markets: [sampleMarket, sportsOnSameEvent],
      sides: sampleSides,
    });

    const result = await syncService.syncEvent(provider, 'KXPRES-24');

    expect(result.status).toBe('success');
    expect(result.eventsUpserted).toBe(1);
    expect(result.marketsUpserted).toBe(2);

    const rows = await db.select().from(markets);
    expect(rows).toHaveLength(2);
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
