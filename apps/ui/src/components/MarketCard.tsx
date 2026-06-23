'use client';

import { memo } from 'react';
import { CopyIdRow } from '@/components/CopyIdRow';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketSummary } from '@/lib/api';
import { copyId } from '@/lib/copy-id';
import { formatDate, formatPrice, marketDisplayTitle } from '@/lib/format';
import { resolveImpliedProbability, resolveNoImpliedProbability, type MarketPayoutSortInput } from '@/lib/sort-markets';
import { cn } from '@/lib/utils';

export const MarketCard = memo(function MarketCard({
  market,
  onOpen,
}: {
  market: MarketSummary & MarketPayoutSortInput;
  onOpen: (ticker: string) => void;
}) {
  const displayTitle = marketDisplayTitle(market);
  const yesPct = resolveImpliedProbability(market);
  const noPct = resolveNoImpliedProbability(market);
  const hasPricing = yesPct !== null || noPct !== null;

  return (
    <Card
      className={cn(
        'relative gap-0 py-0 transition-colors',
        'hover:bg-muted/50 dark:hover:bg-secondary hover:shadow-md',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:outline-none"
        aria-label={`View Details for ${displayTitle}`}
        onClick={() => {
          onOpen(market.ticker);
        }}
      />
      <CardHeader className="pointer-events-none relative z-10 space-y-0 py-4">
        <div className="min-w-0 space-y-1 text-left">
          <CardTitle>{displayTitle}</CardTitle>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-sm">
            <span className="pointer-events-auto relative z-20 inline-flex">
              <CopyIdRow
                id={market.ticker}
                copyAriaLabel="Copy ID"
                onCopy={(id) => {
                  void copyId(id, 'Market ID');
                }}
              />
            </span>
            <span>
              · {market.status}
              {market.focusTags.length > 0 ? ` · ${market.focusTags.join(', ')}` : ''} · {formatDate(market.closeTime)}
            </span>
          </p>
          <p className="text-sm tabular-nums">
            Last {formatPrice(market.lastPrice)}
            {market.isStale ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Stale
              </span>
            ) : null}
            <span className="text-muted-foreground ml-2 text-xs uppercase">kalshi</span>
            {hasPricing ? (
              <>
                {yesPct !== null ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">Yes</span>{' '}
                    <span className="text-green-600 dark:text-green-400">{formatPrice(yesPct)}</span>
                  </>
                ) : null}
                {noPct !== null ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">No</span>{' '}
                    <span className="text-red-600 dark:text-red-400">{formatPrice(noPct)}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>
      </CardHeader>
    </Card>
  );
});
