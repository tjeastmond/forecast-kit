import type { EventDetailResponse, MarketComparisonRow } from '@/lib/api';
import { sortMarketsByPayoutLikelihood } from '@/lib/sort-markets';

export function sortEventMarkets(markets: readonly MarketComparisonRow[]): MarketComparisonRow[] {
  return sortMarketsByPayoutLikelihood(markets);
}

function focusTagsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((tag, index) => tag === b[index]);
}

export function marketComparisonRowEqual(a: MarketComparisonRow, b: MarketComparisonRow): boolean {
  return (
    a.id === b.id &&
    a.ticker === b.ticker &&
    a.eventTicker === b.eventTicker &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.status === b.status &&
    a.closeTime === b.closeTime &&
    a.category === b.category &&
    focusTagsEqual(a.focusTags, b.focusTags) &&
    a.volume === b.volume &&
    a.lastPrice === b.lastPrice &&
    a.isStale === b.isStale &&
    a.isPinned === b.isPinned &&
    a.volume24h === b.volume24h &&
    a.liquidity === b.liquidity &&
    a.openInterest === b.openInterest &&
    a.yesBid === b.yesBid &&
    a.yesAsk === b.yesAsk &&
    a.spread === b.spread &&
    a.midPrice === b.midPrice &&
    a.impliedProbability === b.impliedProbability
  );
}

function eventMetadataEqual(a: EventDetailResponse, b: EventDetailResponse): boolean {
  return (
    a.id === b.id &&
    a.eventTicker === b.eventTicker &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.category === b.category &&
    a.isDirectlyPinned === b.isDirectlyPinned &&
    a.isPinned === b.isPinned
  );
}

function reconcileMarkets(
  previous: readonly MarketComparisonRow[],
  next: readonly MarketComparisonRow[],
): readonly MarketComparisonRow[] {
  const previousByTicker = new Map(previous.map((market) => [market.ticker, market]));
  let changed = false;
  const reconciled: MarketComparisonRow[] = [];

  for (const market of next) {
    const existing = previousByTicker.get(market.ticker);
    if (existing !== undefined && marketComparisonRowEqual(existing, market)) {
      reconciled.push(existing);
      continue;
    }
    reconciled.push(market);
    changed = true;
  }

  if (!changed && previous.length === next.length) {
    const sameOrder = reconciled.every((market, index) => market === previous[index]);
    if (sameOrder) {
      return previous;
    }
  }

  return reconciled;
}

/** Preserve stable object references when sync returns unchanged data. */
export function reconcileEventDetail(
  previous: EventDetailResponse | null,
  next: EventDetailResponse,
): EventDetailResponse {
  if (previous === null) {
    return next;
  }

  if (!eventMetadataEqual(previous, next)) {
    return next;
  }

  const markets = reconcileMarkets(previous.markets, next.markets);
  if (markets === previous.markets) {
    return previous;
  }

  return {
    ...next,
    markets,
  };
}
