'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { EventSyncButton } from '@/components/EventSyncButton';
import { MarketCard } from '@/components/MarketCard';
import { MarketDetailSheet } from '@/components/MarketDetailSheet';
import { Card } from '@/components/ui/card';
import { fetchEventDetail, type EventDetailResponse, type MarketComparisonRow } from '@/lib/api';

function sortMarkets(markets: readonly MarketComparisonRow[]): MarketComparisonRow[] {
  return [...markets].sort((a, b) => {
    const impliedDelta = (b.impliedProbability ?? 0) - (a.impliedProbability ?? 0);
    if (impliedDelta !== 0) {
      return impliedDelta;
    }
    return b.volume - a.volume;
  });
}

export default function EventDetailPage() {
  const params = useParams<{ eventTicker: string }>();
  const eventTicker = decodeURIComponent(params.eventTicker);
  const [event, setEvent] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEventDetail(eventTicker);
      setEvent(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventTicker]);

  useEffect(() => {
    void load();
  }, [load]);

  const markets = useMemo(() => (event ? sortMarkets(event.markets) : []), [event]);

  function openMarket(ticker: string) {
    setSelectedTicker(ticker);
    setSheetOpen(true);
  }

  return (
    <AppShell hasUnsavedEdits={hasUnsavedEdits}>
      <Link href="/events" className="text-muted-foreground mb-4 inline-block text-sm">
        ← Events
      </Link>
      {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
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
            <EventSyncButton
              eventTicker={event.eventTicker}
              hasUnsavedEdits={hasUnsavedEdits}
              onSynced={() => {
                void load();
              }}
            />
          </div>

          <div className="space-y-4">
            {markets.map((market) => (
              <MarketCard key={market.ticker} market={market} onOpen={openMarket} />
            ))}
            {!loading && markets.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No markets found for this event.</p>
                <EventSyncButton
                  eventTicker={event.eventTicker}
                  hasUnsavedEdits={hasUnsavedEdits}
                  onSynced={() => {
                    void load();
                  }}
                />
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
      <MarketDetailSheet
        ticker={selectedTicker}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDirtyChange={setHasUnsavedEdits}
      />
    </AppShell>
  );
}
