'use client';

import Link from 'next/link';
import { EventListPageClient } from '@/components/EventListPageClient';
import { savePinnedListReturn } from '@/lib/marketFilterParams';

export function PinnedPageClient() {
  return (
    <EventListPageClient
      config={{
        pinned: true,
        heading: 'Pinned',
        countLabel: 'Pinned Events',
        emptyMessage: 'Nothing pinned yet. Pin events or markets from an event page.',
        emptyAction: (
          <Link href="/events" className="text-sm underline underline-offset-4">
            Browse All Events
          </Link>
        ),
        saveListReturn: savePinnedListReturn,
        subtitleLink: { href: '/events', label: 'Browse All Events' },
      }}
    />
  );
}
