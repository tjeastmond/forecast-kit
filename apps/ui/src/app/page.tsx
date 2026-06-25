import { Suspense } from 'react';
import { EventListPageFallback } from '@/components/EventListPageClient';
import { PinnedPageClient } from '@/components/PinnedPageClient';

export default function HomePage() {
  return (
    <Suspense fallback={<EventListPageFallback />}>
      <PinnedPageClient />
    </Suspense>
  );
}
