'use client';

import { EventListPageClient } from '@/components/EventListPageClient';
import { saveEventsListReturn } from '@/lib/marketFilterParams';

export { EventListPageFallback as EventsPageFallback } from '@/components/EventListPageClient';

export function EventsPageClient() {
  return (
    <EventListPageClient
      config={{
        heading: 'Events',
        countLabel: 'Events',
        emptyMessage: 'No events found.',
        saveListReturn: saveEventsListReturn,
        subtitleLink: { href: '/', label: 'Browse All Pins' },
      }}
    />
  );
}
