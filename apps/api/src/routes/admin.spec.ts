import { deriveFocusTags } from '@forecast-kit/core';
import type { NormalizedEvent, NormalizedMarket } from '@forecast-kit/core';
import { createQueryServices } from '@forecast-kit/db/query';
import { createRepositories } from '@forecast-kit/db/repositories';
import { createTestDatabase } from '@forecast-kit/db/test-utils';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { adminRoutes } from './admin.js';

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

describe('API admin routes', () => {
  it('patches market fields', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const app = Fastify({ logger: false });
    app.decorate('repos', repos);
    app.decorate('query', createQueryServices(db));
    await app.register(adminRoutes);

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/markets/KXPRES-24-DEM',
      payload: { title: 'Patched title', isStale: true },
    });

    expect(response.statusCode).toBe(200);
    const body: { title: string; isStale: boolean } = response.json();
    expect(body.title).toBe('Patched title');
    expect(body.isStale).toBe(true);
  });

  it('replaces focus tags', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const app = Fastify({ logger: false });
    app.decorate('repos', repos);
    app.decorate('query', createQueryServices(db));
    await app.register(adminRoutes);

    const response = await app.inject({
      method: 'PUT',
      url: '/admin/markets/KXPRES-24-DEM/focus-tags',
      payload: { focusTags: ['economics'] },
    });

    expect(response.statusCode).toBe(200);
    const body: { focusTags: string[] } = response.json();
    expect(body.focusTags).toEqual(['economics']);
  });

  it('pins and unpins events', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    await repos.events.upsert(politicsEvent);

    const app = Fastify({ logger: false });
    app.decorate('repos', repos);
    app.decorate('query', createQueryServices(db));
    await app.register(adminRoutes);

    const pinResponse = await app.inject({
      method: 'PUT',
      url: '/admin/events/KXPRES-24/pin',
    });
    expect(pinResponse.statusCode).toBe(200);
    const pinnedBody: { isDirectlyPinned: boolean } = pinResponse.json();
    expect(pinnedBody.isDirectlyPinned).toBe(true);

    const unpinResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/events/KXPRES-24/pin',
    });
    expect(unpinResponse.statusCode).toBe(200);
    const unpinnedBody: { isDirectlyPinned: boolean } = unpinResponse.json();
    expect(unpinnedBody.isDirectlyPinned).toBe(false);
  });

  it('pins and unpins markets', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const marketId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(marketId, deriveFocusTags(politicsMarket));

    const app = Fastify({ logger: false });
    app.decorate('repos', repos);
    app.decorate('query', createQueryServices(db));
    await app.register(adminRoutes);

    const pinResponse = await app.inject({
      method: 'PUT',
      url: '/admin/markets/KXPRES-24-DEM/pin',
    });
    expect(pinResponse.statusCode).toBe(200);
    expect(await repos.pins.isPinned('kalshi', 'market', 'KXPRES-24-DEM')).toBe(true);

    const unpinResponse = await app.inject({
      method: 'DELETE',
      url: '/admin/markets/KXPRES-24-DEM/pin',
    });
    expect(unpinResponse.statusCode).toBe(200);
    expect(await repos.pins.isPinned('kalshi', 'market', 'KXPRES-24-DEM')).toBe(false);
  });
});
