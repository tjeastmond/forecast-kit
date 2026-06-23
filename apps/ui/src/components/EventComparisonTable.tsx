'use client';

import type { MarketComparisonRow } from '@/lib/api';
import { formatDate, formatNumber, formatPrice, formatSpread, marketDisplayTitle } from '@/lib/format';

export function EventComparisonTable({
  markets,
  maxImplied,
  onSelectMarket,
}: {
  markets: readonly MarketComparisonRow[];
  maxImplied: number;
  onSelectMarket: (ticker: string) => void;
}) {
  const sorted = [...markets].sort((a, b) => (b.impliedProbability ?? 0) - (a.impliedProbability ?? 0));

  return (
    <div className="overflow-x-auto">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Outcome</th>
            <th>Ticker</th>
            <th>Status</th>
            <th>Implied %</th>
            <th>Bar</th>
            <th>Last</th>
            <th>Mid</th>
            <th>Spread</th>
            <th>Volume</th>
            <th>Vol 24h</th>
            <th>Liquidity</th>
            <th>OI</th>
            <th>Close</th>
            <th>Stale</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((market) => {
            const implied = market.impliedProbability ?? 0;
            const barWidth = maxImplied > 0 ? (implied / maxImplied) * 100 : 0;
            return (
              <tr
                key={market.ticker}
                onClick={() => {
                  onSelectMarket(market.ticker);
                }}
              >
                <td className="max-w-[12rem] truncate">{marketDisplayTitle(market)}</td>
                <td className="font-mono text-xs">{market.ticker}</td>
                <td>{market.status}</td>
                <td>{formatPrice(market.impliedProbability)}</td>
                <td className="min-w-[8rem]">
                  <div className="probability-bar">
                    <div className="probability-bar-fill" style={{ width: `${String(barWidth)}%` }} />
                  </div>
                </td>
                <td>{formatPrice(market.lastPrice)}</td>
                <td>{formatPrice(market.midPrice)}</td>
                <td>{formatSpread(market.spread)}</td>
                <td>{formatNumber(market.volume)}</td>
                <td>{formatNumber(market.volume24h)}</td>
                <td>{formatNumber(market.liquidity)}</td>
                <td>{formatNumber(market.openInterest)}</td>
                <td>{formatDate(market.closeTime)}</td>
                <td>{market.isStale ? 'yes' : 'no'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
