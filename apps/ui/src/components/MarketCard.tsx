'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { MarketSummary } from '@/lib/api';
import { formatDate, formatPrice, marketDisplayTitle } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MarketCard({ market, onOpen }: { market: MarketSummary; onOpen: (ticker: string) => void }) {
  const displayTitle = marketDisplayTitle(market);

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
      <CardHeader className="pointer-events-none relative z-10 flex flex-row items-start justify-between gap-3 space-y-0 py-4">
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <CardTitle>{displayTitle}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {market.eventTicker} · {market.status}
            {market.focusTags.length > 0 ? ` · ${market.focusTags.join(', ')}` : ''} · {formatDate(market.closeTime)}
          </p>
          <p className="text-sm">
            Last {formatPrice(market.lastPrice)}
            {market.isStale ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Stale
              </span>
            ) : null}
            <span className="text-muted-foreground ml-2 text-xs uppercase">kalshi</span>
          </p>
        </div>
      </CardHeader>
    </Card>
  );
}
