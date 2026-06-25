'use client';

import Link from 'next/link';
import { PinButton } from '@/components/PinButton';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventRow } from '@/lib/api';
import { cn } from '@/lib/utils';

export function EventCard({
  event,
  marketCount,
  isDirectlyPinned,
  onPinChange,
}: {
  event: EventRow;
  marketCount?: number;
  isDirectlyPinned: boolean;
  onPinChange?: () => void;
}) {
  return (
    <Card
      className={cn(
        'relative gap-0 py-0 transition-colors',
        'hover:bg-muted/50 dark:hover:bg-secondary hover:shadow-md',
      )}
    >
      <Link
        href={`/events/${encodeURIComponent(event.eventTicker)}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:outline-none"
        aria-label={`Open ${event.title}`}
      />
      <CardHeader className="pointer-events-none relative z-10 space-y-1 py-4 pr-14">
        <CardTitle>{event.title}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {event.eventTicker}
          {event.category ? ` · ${event.category}` : ''}
          {marketCount !== undefined ? ` · ${String(marketCount)} markets` : ''}
        </p>
      </CardHeader>
      <div className="pointer-events-auto absolute top-3 right-3 z-20">
        <PinButton
          targetType="event"
          ticker={event.eventTicker}
          pinned={isDirectlyPinned}
          onPinChange={() => {
            onPinChange?.();
          }}
        />
      </div>
    </Card>
  );
}
