import type {
  MarketStatus,
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  ProviderEventBatch,
} from '@forcast-kit/core';
import { parseDecimal, parseDecimalOrNull } from './parse-decimal.js';
import type { KalshiEvent, KalshiMarket } from './schemas.js';

const PROVIDER = 'kalshi' as const;

export function mapKalshiStatus(status: string): MarketStatus {
  switch (status) {
    case 'open':
      return 'open';
    case 'active':
      return 'active';
    case 'closed':
      return 'closed';
    case 'settled':
      return 'settled';
    case 'unopened':
      return 'unopened';
    default:
      return 'open';
  }
}

export function mapMarketType(marketType: string): 'binary' | 'scalar' {
  return marketType === 'scalar' ? 'scalar' : 'binary';
}

export function normalizeEvent(raw: KalshiEvent): NormalizedEvent {
  const settlementSources =
    raw.settlement_sources?.map((source) => source.name).filter((name) => name.length > 0) ?? [];

  return {
    provider: PROVIDER,
    externalEventId: raw.event_ticker,
    eventTicker: raw.event_ticker,
    seriesTicker: raw.series_ticker,
    title: raw.title,
    subtitle: raw.sub_title ?? '',
    category: raw.category ?? null,
    settlementSources,
    rawJson: raw,
  };
}

export function normalizeMarket(raw: KalshiMarket, event: KalshiEvent): NormalizedMarket {
  return {
    provider: PROVIDER,
    externalMarketId: raw.ticker,
    ticker: raw.ticker,
    eventTicker: raw.event_ticker,
    seriesTicker: event.series_ticker,
    title: raw.title,
    subtitle: '',
    category: event.category ?? null,
    marketType: mapMarketType(raw.market_type),
    status: mapKalshiStatus(raw.status),
    openTime: new Date(raw.open_time),
    closeTime: new Date(raw.close_time),
    expirationTime: raw.expiration_time ? new Date(raw.expiration_time) : null,
    volume: parseDecimal(raw.volume_fp),
    volume24h: parseDecimal(raw.volume_24h_fp),
    liquidity: parseDecimal(raw.liquidity_dollars),
    openInterest: parseDecimal(raw.open_interest_fp),
    yesBid: parseDecimalOrNull(raw.yes_bid_dollars),
    yesAsk: parseDecimalOrNull(raw.yes_ask_dollars),
    noBid: parseDecimalOrNull(raw.no_bid_dollars),
    noAsk: parseDecimalOrNull(raw.no_ask_dollars),
    lastPrice: parseDecimalOrNull(raw.last_price_dollars),
    rulesPrimary: raw.rules_primary ?? null,
    rulesSecondary: raw.rules_secondary ?? null,
    rawJson: raw,
  };
}

function midPrice(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) {
    return null;
  }
  return (bid + ask) / 2;
}

function isInvestable(status: MarketStatus, bid: number | null, ask: number | null): boolean {
  const tradeable = status === 'open' || status === 'active';
  return tradeable && (bid !== null || ask !== null);
}

export function deriveBinarySides(market: NormalizedMarket): NormalizedMarketSide[] {
  const yesPrice = market.lastPrice ?? midPrice(market.yesBid, market.yesAsk);
  const noPrice = midPrice(market.noBid, market.noAsk);

  return [
    {
      provider: PROVIDER,
      label: 'Yes',
      side: 'yes',
      bid: market.yesBid,
      ask: market.yesAsk,
      price: yesPrice,
      investable: isInvestable(market.status, market.yesBid, market.yesAsk),
      rawJson: { side: 'yes' },
    },
    {
      provider: PROVIDER,
      label: 'No',
      side: 'no',
      bid: market.noBid,
      ask: market.noAsk,
      price: noPrice,
      investable: isInvestable(market.status, market.noBid, market.noAsk),
      rawJson: { side: 'no' },
    },
  ];
}

export function normalizeEventWithMarkets(raw: KalshiEvent): ProviderEventBatch {
  const event = normalizeEvent(raw);
  const markets: NormalizedMarket[] = [];
  const sides: (NormalizedMarketSide & { marketTicker: string })[] = [];

  for (const rawMarket of raw.markets ?? []) {
    const market = normalizeMarket(rawMarket, raw);
    markets.push(market);

    if (market.marketType === 'binary') {
      for (const side of deriveBinarySides(market)) {
        sides.push({ ...side, marketTicker: market.ticker });
      }
    }
  }

  return { events: [event], markets, sides };
}
