'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { EventCard } from '@/components/EventCard';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { fetchEvents, type EventRow } from '@/lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState<readonly EventRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEvents({
        ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
        includeMarkets: true,
        limit: 50,
      });
      setEvents(result.events);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadEvents();
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadEvents]);

  return (
    <AppShell>
      <div className="mb-4">
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          placeholder="Search events…"
        />
      </div>
      <div className="space-y-4">
        {loading
          ? [1, 2, 3].map((key) => <Card key={key} className="h-20 animate-pulse" />)
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
