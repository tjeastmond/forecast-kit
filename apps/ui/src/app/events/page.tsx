'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { EventCard } from '@/components/EventCard';
import {
  MarketFilters,
  emptyMarketFilters,
  filtersToQueryParams,
  hasActiveMarketFilters,
  type MarketFilterState,
} from '@/components/MarketFilters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchEvents, type EventRow } from '@/lib/api';

const PAGE_SIZES = [5, 10, 20, 50] as const;

export default function EventsPage() {
  const [filters, setFilters] = useState<MarketFilterState>(emptyMarketFilters);
  const [events, setEvents] = useState<readonly EventRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cursorStack = useRef<(string | null)[]>([null]);

  const loadEvents = useCallback(
    async (options?: { cursor?: string | null; resetStack?: boolean }) => {
      setLoading(true);
      try {
        const result = await fetchEvents({
          ...filtersToQueryParams(filters),
          includeMarkets: true,
          limit: pageSize,
          ...(options?.cursor ? { cursor: options.cursor } : {}),
        });
        setEvents(result.events);
        setNextCursor(result.cursor);
        if (options?.resetStack) {
          cursorStack.current = [null];
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, pageSize],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEvents({ resetStack: true });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadEvents]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setFilters(emptyMarketFilters());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const isInitialLoad = loading && events.length === 0;
  const isPaginating = loading && events.length > 0;

  return (
    <AppShell
      onTitleClick={() => {
        setFilters(emptyMarketFilters());
      }}
    >
      <MarketFilters
        variant="events"
        filters={filters}
        onFiltersChange={setFilters}
        onClear={() => {
          setFilters(emptyMarketFilters());
        }}
        hasActiveFilters={hasActiveMarketFilters(filters)}
        searchInputRef={searchInputRef}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {isInitialLoad ? 'Loading…' : `${String(events.length)} Events`}
        </p>
        <div className="flex items-center gap-2">
          <select
            className="border-input h-8 rounded-lg border px-2 text-sm"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number.parseInt(event.target.value, 10));
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / Page
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={cursorStack.current.length <= 1}
            onClick={() => {
              cursorStack.current.pop();
              const previous = cursorStack.current[cursorStack.current.length - 1] ?? null;
              void loadEvents({ ...(previous !== null ? { cursor: previous } : {}) });
            }}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            disabled={!nextCursor}
            onClick={() => {
              if (nextCursor) {
                cursorStack.current.push(nextCursor);
                void loadEvents({ cursor: nextCursor });
              }
            }}
          >
            Next
          </Button>
        </div>
      </div>

      <div className={isPaginating ? 'pointer-events-none space-y-4 opacity-60' : 'space-y-4'}>
        {isInitialLoad
          ? [1, 2, 3].map((key) => <Card key={key} className="h-24 animate-pulse" />)
          : events.map((event) => (
              <EventCard
                key={event.eventTicker}
                event={event}
                {...(event.markets !== undefined ? { marketCount: event.markets.length } : {})}
              />
            ))}
        {!loading && events.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No events found.</p>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
