import { deriveFocusTags } from '@forcast-kit/core';
import type { NormalizedMarket } from '@forcast-kit/core';
import { describe, expect, it } from 'vitest';
import { createQueryServices } from '../query/index.js';
import { createRepositories } from '../repositories/index.js';
import { createTestDatabase } from '../test-utils.js';

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
