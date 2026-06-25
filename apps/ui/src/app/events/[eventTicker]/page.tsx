'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { EventSyncButton } from '@/components/EventSyncButton';
import { MarketCard } from '@/components/MarketCard';
import { MarketDetailSheet } from '@/components/MarketDetailSheet';
import { PinButton } from '@/components/PinButton';
import { Card } from '@/components/ui/card';
import { fetchEventDetail, type EventDetailResponse } from '@/lib/api';
import { reconcileEventDetail, sortEventMarkets } from '@/lib/event-detail';
import { readListBackLink } from '@/lib/marketFilterParams';

export default function EventDetailPage() {
  const params = useParams<{ eventTicker: string }>();
  const eventTicker = decodeURIComponent(params.eventTicker);
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backLink, setBackLink] = useState({ href: '/events', label: 'Events' });

  useEffect(() => {
    setBackLink(readListBackLink());
  }, []);
  const hasLoadedRef = useRef(false);

  const applyEventDetail = useCallback((result: EventDetailResponse) => {
    setEvent((previous) => reconcileEventDetail(previous, result));
  }, []);

  const load = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? !hasLoadedRef.current;
      if (showLoading) {
        setLoading(true);
      }
      try {
        const result = await fetchEventDetail(eventTicker);
        applyEventDetail(result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load event');
        setEvent(null);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
        hasLoadedRef.current = true;
      }
    },
    [applyEventDetail, eventTicker],
  );

  const refreshAfterSync = useCallback(async () => {
    try {
      const result = await fetchEventDetail(eventTicker);
      applyEventDetail(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh event');
    }
  }, [applyEventDetail, eventTicker]);

  useEffect(() => {
    hasLoadedRef.current = false;
    void load();
  }, [load]);

  const markets = useMemo(() => (event ? sortEventMarkets(event.markets) : []), [event]);
  const isInitialLoad = loading && event === null;

  const openMarket = useCallback((ticker: string) => {
    setSelectedTicker(ticker);
    setSheetOpen(true);
  }, []);

  const handleSynced = useCallback(() => {
    void refreshAfterSync();
  }, [refreshAfterSync]);

  const handleMarketPinChange = useCallback((ticker: string, pinned: boolean) => {
    setEvent((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        markets: previous.markets.map((market) =>
          market.ticker === ticker ? { ...market, isPinned: pinned } : market,
        ),
      };
    });
  }, []);

  const handleEventPinChange = useCallback((pinned: boolean) => {
    setEvent((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        isDirectlyPinned: pinned,
        isPinned: pinned || previous.markets.some((market) => market.isPinned),
      };
    });
  }, []);

  return (
    <AppShell>
      <Link href={backLink.href} className="text-muted-foreground mb-4 inline-block text-sm">
        ← {backLink.label}
      </Link>
      {isInitialLoad ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
      {event ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-medium">{event.title}</h1>
              <p className="text-muted-foreground text-sm">
                {event.eventTicker}
                {event.category ? ` · ${event.category}` : ''}
                {markets.length > 0 ? ` · ${String(markets.length)} markets` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PinButton
                targetType="event"
                ticker={event.eventTicker}
                pinned={event.isDirectlyPinned}
                onPinChange={handleEventPinChange}
              />
              <EventSyncButton eventTicker={event.eventTicker} onSynced={handleSynced} />
            </div>
          </div>

          <div className="space-y-4">
            {markets.map((market) => (
              <MarketCard key={market.ticker} market={market} onOpen={openMarket} onPinChange={handleMarketPinChange} />
            ))}
            {!isInitialLoad && markets.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No markets found for this event.</p>
                <EventSyncButton eventTicker={event.eventTicker} onSynced={handleSynced} />
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
      <MarketDetailSheet ticker={selectedTicker} open={sheetOpen} onOpenChange={setSheetOpen} />
    </AppShell>
  );
}
