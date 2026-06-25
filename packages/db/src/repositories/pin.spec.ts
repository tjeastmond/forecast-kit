import type { NormalizedEvent } from '@forecast-kit/core';
import { createRepositories } from '@forecast-kit/db/repositories';
import { createTestDatabase } from '@forecast-kit/db/test-utils';
import { describe, expect, it } from 'vitest';

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

describe('PinRepository', () => {
  it('pins and unpins events idempotently', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    await repos.events.upsert(politicsEvent);

    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    expect(await repos.pins.isPinned('kalshi', 'event', 'KXPRES-24')).toBe(true);

    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    expect(await repos.pins.isPinned('kalshi', 'event', 'KXPRES-24')).toBe(true);

    await repos.pins.unpin('kalshi', 'event', 'KXPRES-24');
    expect(await repos.pins.isPinned('kalshi', 'event', 'KXPRES-24')).toBe(false);
  });

  it('surfaces parent event when a market is pinned', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    await repos.events.upsert(politicsEvent);

    const politicsMarket = {
      provider: 'kalshi' as const,
      externalMarketId: 'KXPRES-24-DEM',
      ticker: 'KXPRES-24-DEM',
      eventTicker: 'KXPRES-24',
      seriesTicker: 'KXPRES',
      title: 'Democrat wins?',
      subtitle: '',
      category: 'Politics',
      marketType: 'binary' as const,
      status: 'open' as const,
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

    await repos.markets.upsert(politicsMarket);
    await repos.pins.pin('kalshi', 'market', 'KXPRES-24-DEM');

    const tickers = await repos.pins.getPinnedEventTickers('kalshi');
    expect(tickers).toEqual(['KXPRES-24']);
  });

  it('refreshes pinnedAt on re-pin', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    await repos.events.upsert(politicsEvent);

    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    const first = (await repos.pins.getPinnedAtByEventTicker('kalshi', ['KXPRES-24'])).get('KXPRES-24');

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });

    await repos.pins.pin('kalshi', 'event', 'KXPRES-24');
    const second = (await repos.pins.getPinnedAtByEventTicker('kalshi', ['KXPRES-24'])).get('KXPRES-24');

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }
    expect(second >= first).toBe(true);
  });
});
