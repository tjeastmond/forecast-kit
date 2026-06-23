import { buildMarketExport } from '@forecast-kit/core';
import type { MarketDetail } from '../query/index.js';

export function marketDetailToExport(market: MarketDetail) {
  return buildMarketExport({
    provider: market.provider,
    ticker: market.ticker,
    title: market.title,
    focusTags: market.focusTags,
    isStale: market.isStale,
    yesBid: market.yesBid,
    yesAsk: market.yesAsk,
    noBid: market.noBid,
    noAsk: market.noAsk,
    lastPrice: market.lastPrice,
    volume: market.volume,
    openInterest: market.openInterest,
    openTime: market.openTime,
    closeTime: market.closeTime,
    expirationTime: market.expirationTime,
    rulesPrimary: market.rulesPrimary,
    rulesSecondary: market.rulesSecondary,
    event: market.event ? { ticker: market.event.eventTicker, title: market.event.title } : null,
  });
}
