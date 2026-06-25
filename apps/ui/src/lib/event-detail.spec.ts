import { describe, expect, it } from 'vitest';
import type { EventDetailResponse, MarketComparisonRow } from '@/lib/api';
import { marketComparisonRowEqual, reconcileEventDetail, sortEventMarkets } from '@/lib/event-detail';

function makeMarket(overrides: Partial<MarketComparisonRow> = {}): MarketComparisonRow {
  return {
    id: 1,
    ticker: 'TEST-1',
    eventTicker: 'TEST-EVENT',
    title: 'Outcome A',
    subtitle: '',
    status: 'open',
    closeTime: '2026-06-30T00:00:00.000Z',
    category: 'Politics',
    focusTags: ['politics'],
    volume: 100,
    lastPrice: 0.42,
    isStale: false,
    isPinned: false,
    volume24h: 10,
    liquidity: 5,
    openInterest: 20,
    yesBid: 0.4,
    yesAsk: 0.44,
    spread: 0.04,
    midPrice: 0.42,
    impliedProbability: 0.42,
    ...overrides,
  };
}

function makeEvent(markets: readonly MarketComparisonRow[]): EventDetailResponse {
  return {
    id: 10,
    eventTicker: 'TEST-EVENT',
    title: 'Test Event',
    subtitle: '',
    category: 'Politics',
    isDirectlyPinned: false,
    markets,
  };
}

describe('marketComparisonRowEqual', () => {
  it('returns true for identical rows', () => {
    const market = makeMarket();
    expect(marketComparisonRowEqual(market, { ...market })).toBe(true);
  });

  it('returns false when pricing changes', () => {
    const before = makeMarket();
    const after = makeMarket({ lastPrice: 0.5 });
    expect(marketComparisonRowEqual(before, after)).toBe(false);
  });
});

describe('reconcileEventDetail', () => {
  it('returns previous reference when nothing changed', () => {
    const market = makeMarket();
    const previous = makeEvent([market]);
    const next = makeEvent([{ ...market }]);

    expect(reconcileEventDetail(previous, next)).toBe(previous);
  });

  it('preserves unchanged market references when one market updates', () => {
    const unchanged = makeMarket({ id: 1, ticker: 'TEST-1' });
    const changedBefore = makeMarket({ id: 2, ticker: 'TEST-2', lastPrice: 0.3 });
    const previous = makeEvent([unchanged, changedBefore]);
    const next = makeEvent([{ ...unchanged }, makeMarket({ id: 2, ticker: 'TEST-2', lastPrice: 0.35 })]);

    const reconciled = reconcileEventDetail(previous, next);
    expect(reconciled).not.toBe(previous);
    expect(reconciled.markets[0]).toBe(unchanged);
    expect(reconciled.markets[1]?.lastPrice).toBe(0.35);
  });

  it('returns next event when metadata changes', () => {
    const market = makeMarket();
    const previous = makeEvent([market]);
    const next: EventDetailResponse = { ...makeEvent([market]), title: 'Updated title' };

    expect(reconcileEventDetail(previous, next)).toBe(next);
  });
});

describe('sortEventMarkets', () => {
  it('sorts by implied probability then volume', () => {
    const low = makeMarket({ ticker: 'LOW', impliedProbability: 0.2, volume: 1000 });
    const high = makeMarket({ ticker: 'HIGH', impliedProbability: 0.8, volume: 10 });
    const tie = makeMarket({ ticker: 'TIE', impliedProbability: 0.8, volume: 500 });

    expect(sortEventMarkets([low, high, tie]).map((market) => market.ticker)).toEqual(['TIE', 'HIGH', 'LOW']);
  });
});
