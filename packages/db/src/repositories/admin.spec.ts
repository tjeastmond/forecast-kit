import { deriveFocusTags } from '@forecast-kit/core';
import type { NormalizedMarket } from '@forecast-kit/core';
import { createQueryServices } from '@forecast-kit/db/query';
import { createRepositories } from '@forecast-kit/db/repositories';
import { createTestDatabase } from '@forecast-kit/db/test-utils';
import { describe, expect, it } from 'vitest';

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

describe('MarketRepository.updatePartial', () => {
  it('updates editable fields and leaves others unchanged', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const updatedId = await repos.markets.updatePartial('KXPRES-24-DEM', {
      title: 'Updated title',
      lastPrice: 0.55,
      isStale: true,
    });

    expect(updatedId).toBe(marketId);

    const query = createQueryServices(db);
    const detail = await query.markets.getMarketByTicker('KXPRES-24-DEM');
    expect(detail?.title).toBe('Updated title');
    expect(detail?.lastPrice).toBeCloseTo(0.55);
    expect(detail?.isStale).toBe(true);
    expect(detail?.yesBid).toBeCloseTo(0.4);
  });

  it('returns null for unknown ticker', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const result = await repos.markets.updatePartial('MISSING', { title: 'Nope' });
    expect(result).toBeNull();
  });
});

describe('MarketQueryService stale filter', () => {
  it('filters markets by isStale', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    const freshId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(freshId, deriveFocusTags(politicsMarket));
    await repos.markets.updatePartial('KXPRES-24-DEM', { isStale: true });

    const staleOnly = await query.markets.listMarkets({ stale: true });
    expect(staleOnly.markets).toHaveLength(1);
    expect(staleOnly.markets[0]?.isStale).toBe(true);

    const freshOnly = await query.markets.listMarkets({ stale: false });
    expect(freshOnly.markets).toHaveLength(0);
  });
});

describe('SyncRunQueryService.listRuns', () => {
  it('returns sync runs newest first', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    const firstId = await repos.syncRuns.create('kalshi');
    await repos.syncRuns.finish(firstId, {
      status: 'success',
      eventsUpserted: 1,
      marketsUpserted: 2,
      errorsCount: 0,
    });
    const secondId = await repos.syncRuns.create('kalshi');

    const result = await query.syncRuns.listRuns({ limit: 10 });
    expect(result.syncRuns.length).toBeGreaterThanOrEqual(2);
    expect(result.syncRuns[0]?.id).toBe(secondId);
  });
});
