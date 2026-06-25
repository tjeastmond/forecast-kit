'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { EventCard } from '@/components/EventCard';
import { MarketFilters } from '@/components/MarketFilters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useEventListParams } from '@/hooks/useEventListParams';
import { fetchEvents, type EventRow } from '@/lib/api';
import { clearEventsListCache, getEventsListCache, setEventsListCache } from '@/lib/eventsListCache';
import {
  buildEventsFetchOptions,
  buildEventsListCacheKey,
  EVENT_LIST_PAGE_SIZES,
  isEventListPageSize,
} from '@/lib/marketFilterParams';
import { hasActiveMarketFilters, type MarketFilterState } from '@/lib/marketFilters';

export interface EventListPageConfig {
  readonly pinned?: boolean;
  readonly heading: string;
  readonly countLabel: string;
  readonly emptyMessage: string;
  readonly emptyAction?: ReactNode;
  readonly saveListReturn: (queryString: string) => void;
  readonly subtitleLink?: { readonly href: string; readonly label: string };
}

export function EventListPageClient({ config }: { config: EventListPageConfig }) {
  const { params, cursorStack, canGoPrev, setFilters, setPageSize, goNext, goPrev, clearAll, listQueryString } =
    useEventListParams();

  const cacheKey = useMemo(() => {
    if (config.pinned === true) {
      return buildEventsListCacheKey(params, { pinned: true });
    }
    return buildEventsListCacheKey(params);
  }, [params, config.pinned]);
  const hidePagination = config.pinned === true;

  const cached = getEventsListCache(cacheKey);
  const [events, setEvents] = useState<readonly EventRow[]>(cached?.events ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(cached?.nextCursor ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [searchDraft, setSearchDraft] = useState(params.filters.searchQuery);
  const [reloadToken, setReloadToken] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchDraft(params.filters.searchQuery);
  }, [params.filters.searchQuery]);

  useEffect(() => {
    if (searchDraft === params.filters.searchQuery) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setFilters({ ...params.filters, searchQuery: searchDraft });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [params.filters, searchDraft, setFilters]);

  useEffect(() => {
    config.saveListReturn(listQueryString);
  }, [config, listQueryString]);

  useEffect(() => {
    const cachedList = getEventsListCache(cacheKey);
    if (cachedList !== undefined) {
      setEvents((current) => (current === cachedList.events ? current : cachedList.events));
      setNextCursor((current) => (current === cachedList.nextCursor ? current : cachedList.nextCursor));
      setLoading((current) => (current ? false : current));
      return;
    }

    const stackForCache = cursorStack;
    let cancelled = false;

    async function loadEvents(): Promise<void> {
      setLoading(true);
      try {
        const result = await fetchEvents(
          config.pinned === true ? buildEventsFetchOptions(params, { pinned: true }) : buildEventsFetchOptions(params),
        );
        if (cancelled) {
          return;
        }
        setEvents(result.events);
        setNextCursor(result.cursor);
        setEventsListCache(cacheKey, {
          events: result.events,
          nextCursor: result.cursor,
          cursorStack: stackForCache,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        toast.error(error instanceof Error ? error.message : 'Failed to load events');
        setEvents([]);
        setNextCursor(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, config.pinned, cursorStack, params, reloadToken]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        clearAll();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clearAll]);

  const handlePinChange = () => {
    clearEventsListCache();
    setReloadToken((current) => current + 1);
  };

  const displayFilters: MarketFilterState = { ...params.filters, searchQuery: searchDraft };
  const isInitialLoad = loading && events.length === 0;
  const isPaginating = loading && events.length > 0;

  return (
    <AppShell onTitleClick={clearAll}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">{config.heading}</h1>
          {config.subtitleLink ? (
            <Link
              href={config.subtitleLink.href}
              className="text-muted-foreground mt-1 inline-block text-sm hover:underline"
            >
              {config.subtitleLink.label}
            </Link>
          ) : null}
        </div>
      </div>

      <MarketFilters
        variant="events"
        filters={displayFilters}
        onFiltersChange={(next) => {
          if (next.searchQuery !== searchDraft) {
            setSearchDraft(next.searchQuery);
            return;
          }
          setFilters(next);
        }}
        onClear={clearAll}
        hasActiveFilters={hasActiveMarketFilters(displayFilters)}
        searchInputRef={searchInputRef}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {isInitialLoad ? 'Loading…' : `${String(events.length)} ${config.countLabel}`}
        </p>
        <div className="flex items-center gap-2">
          <select
            className="border-input h-8 rounded-lg border px-2 text-sm"
            value={params.pageSize}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (isEventListPageSize(parsed)) {
                setPageSize(parsed);
              }
            }}
          >
            {EVENT_LIST_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / Page
              </option>
            ))}
          </select>
          {!hidePagination ? (
            <>
              <Button variant="outline" disabled={!canGoPrev} onClick={goPrev}>
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={!nextCursor}
                onClick={() => {
                  if (nextCursor) {
                    goNext(nextCursor);
                  }
                }}
              >
                Next
              </Button>
            </>
          ) : null}
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
                isDirectlyPinned={event.isDirectlyPinned ?? false}
                onPinChange={handlePinChange}
              />
            ))}
        {!loading && events.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{config.emptyMessage}</p>
            {config.emptyAction}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

export function EventListPageFallback() {
  return (
    <AppShell>
      <div className="space-y-4">
        {[1, 2, 3].map((key) => (
          <Card key={key} className="h-24 animate-pulse" />
        ))}
      </div>
    </AppShell>
  );
}
