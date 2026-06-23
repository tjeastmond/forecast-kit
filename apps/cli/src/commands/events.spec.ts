import { deriveFocusTags } from '@forecast-kit/core';
import type { NormalizedEvent, NormalizedMarket } from '@forecast-kit/core';
import { createQueryServices } from '@forecast-kit/db/query';
import { createRepositories } from '@forecast-kit/db/repositories';
import { createTestDatabase } from '@forecast-kit/db/test-utils';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args.js';
import { runCommand } from './index.js';
import { formatEventList, listEventsWithQuery, parseEventTickersFromListOutput } from './events.js';

const sampleEvent: NormalizedEvent = {
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

const otherEvent: NormalizedEvent = {
  ...sampleEvent,
  externalEventId: 'KXNBA-25',
  eventTicker: 'KXNBA-25',
  seriesTicker: 'KXNBA',
  title: 'NBA Championship 2025',
  category: 'Sports',
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
  externalMarketId: 'KXNBA-25-LAL',
  ticker: 'KXNBA-25-LAL',
  eventTicker: 'KXNBA-25',
  seriesTicker: 'KXNBA',
  title: 'Lakers win NBA title?',
  category: 'Sports',
};

describe('formatEventList', () => {
  it('parses tickers from formatted output', () => {
    const output = formatEventList([
      { eventTicker: 'KXPRES-24', category: 'Politics', title: '2024 Presidential Election' },
      { eventTicker: 'KXNBA-25', category: 'Sports', title: 'NBA Championship 2025' },
    ]);

    expect(parseEventTickersFromListOutput(output)).toEqual(['KXPRES-24', 'KXNBA-25']);
  });
});

describe('CLI events parity with query layer', () => {
  it('returns the same event tickers as listEvents for identical filters (API uses the same path)', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const query = createQueryServices(db);

    await repos.events.upsert(sampleEvent);
    await repos.events.upsert(otherEvent);

    const politicsId = await repos.markets.upsert(politicsMarket);
    await repos.marketFocusTags.replaceTags(politicsId, deriveFocusTags(politicsMarket));

    const sportsId = await repos.markets.upsert(sportsMarket);
    await repos.marketFocusTags.replaceTags(sportsId, deriveFocusTags(sportsMarket));

    const { events } = await query.events.listEvents({ focus: ['politics'], limit: 50 });
    const queryTickers = events.map((event) => String(event['eventTicker']));

    const cliResult = await listEventsWithQuery(query, parseArgs(['events', '--focus', 'politics']));
    expect(cliResult.exitCode).toBe(0);
    expect(cliResult.message).toBeDefined();

    const cliTickers = parseEventTickersFromListOutput(cliResult.message ?? '');
    expect(cliTickers).toEqual(queryTickers);
  });

  it('routes the event alias to the same handler', async () => {
    const eventsResult = await runCommand(parseArgs(['events', '--help']));
    const eventResult = await runCommand(parseArgs(['event', '--help']));
    expect(eventsResult.exitCode).toBe(0);
    expect(eventResult.exitCode).toBe(0);
    expect(eventsResult.message).toBe(eventResult.message);
  });
});
