'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchSyncRun, startEventSync } from '@/lib/api';

export function EventSyncButton({
  eventTicker,
  hasUnsavedEdits,
  onSynced,
}: {
  eventTicker: string;
  hasUnsavedEdits: boolean;
  onSynced: () => void;
}) {
  const [runningId, setRunningId] = useState<number | null>(null);

  useEffect(() => {
    if (runningId === null) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchSyncRun(runningId)
        .then((run) => {
          if (run.status !== 'running') {
            setRunningId(null);
            if (run.status === 'success' || run.status === 'partial') {
              toast.success(`Event synced: ${String(run.marketsUpserted)} markets updated`);
              onSynced();
              return;
            }
            toast.error(run.errorSummary ?? `Sync ${run.status}`);
          }
        })
        .catch(() => {
          setRunningId(null);
        });
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [runningId, onSynced]);

  async function handleSync() {
    if (hasUnsavedEdits) {
      toast.error('Save or discard sheet edits before syncing — sync overwrites manual changes.');
      return;
    }

    try {
      const result = await startEventSync(eventTicker);
      setRunningId(result.syncRunId);
      toast.info('Event sync started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Event sync failed');
    }
  }

  return (
    <Button
      variant="outline"
      className="header-toolbar-outline"
      onClick={() => void handleSync()}
      disabled={runningId !== null}
    >
      <RefreshCwIcon className={`mr-1.5 size-4 ${runningId !== null ? 'animate-spin' : ''}`} />
      {runningId !== null ? 'Syncing…' : 'Sync event'}
    </Button>
  );
}
