import { deriveFocusTags } from '@forecast-kit/core';
import type { NormalizedEvent, NormalizedMarket } from '@forecast-kit/core';
import { describe, expect, it } from 'vitest';
import { createQueryServices } from '../query/index.js';
import { createRepositories } from '../repositories/index.js';
import { createTestDatabase } from '../test-utils.js';

const politicsEvent: NormalizedEvent = {
  provider: 'kalshi',
  externalEventId: 'KXPRES-24',
  eventTicker: 'KXPRES-24',
  seriesTicker: 'KXPRES',
  title: '2024 Presidential Election',
  subtitle: '',
  category: 'Politics',
  settlementSources: [],
  rawJson: {},
};

const sportsEvent: NormalizedEvent = {
  provider: 'kalshi',
  externalEventId: 'KXNBA-25',
  eventTicker: 'KXNBA-25',
  seriesTicker: 'KXNBA',
  title: 'NBA Finals',
  subtitle: '',
  category: 'Sports',
  settlementSources: [],
  rawJson: {},
};

const politicsMarket: NormalizedMarket = {
  provider: 'kalshi',
  externalMarketId: 'KXPRES-24-DEM',
  ticker: 'KXPRES-24-DEM',
  eventTicker: 'KXPRES-24',
  seriesTicker: 'KXPRES',
  title: 'Democrat wins 2024 election?',
  subtitle: '',
  category: 'Politics',
  marketType: 'binary',
  status: 'open',
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
  rawJson: {},
};

const sportsMarket: NormalizedMarket = {
  ...politicsMarket,
  externalMarketId: 'KXNBA-25',
  ticker: 'KXNBA-25-LAL',
  eventTicker: 'KXNBA-25',
  seriesTicker: 'KXNBA',
  title: 'Lakers win NBA title?',
  category: 'Sports',
};

describe('MarketQueryService', () => {
  it('filters markets by focus tags', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    const politicsId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(politicsId, deriveFocusTags(politicsMarket));

    const sportsId = await repos.markets.upsert(sportsMarket);
    await repos.marketFocusTags.replaceTags(sportsId, deriveFocusTags(sportsMarket));

    const politicsOnly = await query.markets.listMarkets({ focus: ['politics'] });
    expect(politicsOnly.markets).toHaveLength(1);
    expect(politicsOnly.markets[0]?.ticker).toBe('KXPRES-24-DEM');

    const withoutSports = await query.markets.listMarkets({ exclude: ['sports'] });
    expect(withoutSports.markets).toHaveLength(1);
    expect(withoutSports.markets[0]?.ticker).toBe('KXPRES-24-DEM');
  });

  it('returns market detail with focus tags and sides', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, ['politics']);
    await repos.marketSides.upsert(marketId, {
      provider: 'kalshi',
      label: 'Yes',
      side: 'yes',
      bid: 0.4,
      ask: 0.42,
      price: 0.41,
      investable: true,
      rawJson: {},
    });

    const detail = await query.markets.getMarketByTicker('KXPRES-24-DEM');
    expect(detail?.focusTags).toEqual(['politics']);
    expect(detail?.sides).toHaveLength(1);
  });
});

describe('EventQueryService pinned filter', () => {
  it('returns directly pinned events', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    await repos.events.upsert(politicsEvent);
    await repos.events.upsert(sportsEvent);
    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');

    const pinned = await query.events.listEvents({ pinned: true });
    expect(pinned.events).toHaveLength(1);
    expect(pinned.events[0]?.eventTicker).toBe('KXPRES-24');
    expect(pinned.events[0]?.isPinned).toBe(true);
    expect(pinned.events[0]?.isDirectlyPinned).toBe(true);
    expect(pinned.cursor).toBeNull();
  });

  it('surfaces parent event when a market is pinned', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    await repos.events.upsert(politicsEvent);
    const politicsId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(politicsId, deriveFocusTags(politicsMarket));
    await repos.pins.pin('kalshi', 'market', 'KXPRES-24-DEM');

    const pinned = await query.events.listEvents({ pinned: true });
    expect(pinned.events).toHaveLength(1);
    expect(pinned.events[0]?.eventTicker).toBe('KXPRES-24');
    expect(pinned.events[0]?.isPinned).toBe(true);
    expect(pinned.events[0]?.isDirectlyPinned).toBe(false);
  });

  it('applies focus filters to pinned events', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    await repos.events.upsert(politicsEvent);
    await repos.events.upsert(sportsEvent);

    const politicsId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(politicsId, deriveFocusTags(politicsMarket));
    const sportsId = await repos.markets.upsert(sportsMarket);
    await repos.marketFocusTags.replaceTags(sportsId, deriveFocusTags(sportsMarket));

    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    await repos.pins.pin('kalshi', 'event', 'KXNBA-25');

    const politicsOnly = await query.events.listEvents({ pinned: true, focus: ['politics'] });
    expect(politicsOnly.events).toHaveLength(1);
    expect(politicsOnly.events[0]?.eventTicker).toBe('KXPRES-24');
  });

  it('removes events after unpin', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    await repos.events.upsert(politicsEvent);
    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    await repos.pins.unpin('kalshi', 'event', 'KXPRES-24');

    const pinned = await query.events.listEvents({ pinned: true });
    expect(pinned.events).toHaveLength(0);
  });
});
