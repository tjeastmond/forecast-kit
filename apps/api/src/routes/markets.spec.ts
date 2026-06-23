import { deriveFocusTags, marketExportV1Schema } from '@forcast-kit/core';
import type { NormalizedMarket } from '@forcast-kit/core';
import { createQueryServices } from '@forcast-kit/db/query';
import { createRepositories } from '@forcast-kit/db/repositories';
import { createTestDatabase } from '@forcast-kit/db/test-utils';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { corsPlugin } from '../plugins/cors.js';
import { marketRoutes } from './markets.js';

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

describe('API market routes', () => {
  it('returns filtered markets consistent with stored focus tags', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const app = Fastify({ logger: false });
    app.decorate('query', createQueryServices(db));
    await app.register(marketRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/markets?focus=politics&limit=5',
    });

    expect(response.statusCode).toBe(200);
    const body: { markets: { ticker: string }[] } = response.json();
    expect(body.markets.length).toBeGreaterThanOrEqual(1);
    expect(body.markets[0]?.ticker).toBe('KXPRES-24-DEM');

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/markets/KXPRES-24-DEM',
    });

    expect(detailResponse.statusCode).toBe(200);
    const detail: { focusTags: string[] } = detailResponse.json();
    expect(detail.focusTags).toContain('politics');
  });

  it('returns agent export JSON for a market', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const app = Fastify({ logger: false });
    app.decorate('query', createQueryServices(db));
    await app.register(marketRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/markets/KXPRES-24-DEM/export',
    });

    expect(response.statusCode).toBe(200);
    const body = marketExportV1Schema.parse(response.json());
    expect(body.schemaVersion).toBe('1.0');
    expect(body.ticker).toBe('KXPRES-24-DEM');
    expect(body.pricing.impliedProbability).toBeCloseTo(0.41);
  });

  it('handles CORS preflight for UI origins', async () => {
    const app = Fastify({ logger: false });
    await app.register(corsPlugin);
    await app.register(marketRoutes);

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/markets?limit=10',
      headers: {
        origin: 'http://localhost:3848',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3848');
  });
});
