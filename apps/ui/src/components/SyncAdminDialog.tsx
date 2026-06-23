'use client';

import { FOCUS_VALUES, type Focus } from '@/lib/constants';
import { SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label } from '@/components/ui/input';
import { fetchSyncRun, fetchSyncRuns, getApiBaseUrl, startSync, type SyncRunRow } from '@/lib/api';
import { formatDate } from '@/lib/format';

export function SyncAdminDialog({
  open,
  onOpenChange,
  hasUnsavedEdits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasUnsavedEdits: boolean;
}) {
  const [focusText, setFocusText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [full, setFull] = useState(false);
  const [maxPages, setMaxPages] = useState('');
  const [runningId, setRunningId] = useState<number | null>(null);
  const [syncRuns, setSyncRuns] = useState<readonly SyncRunRow[]>([]);

  useEffect(() => {
    if (open) {
      void fetchSyncRuns(20)
        .then((result) => {
          setSyncRuns(result.syncRuns);
        })
        .catch(() => {
          setSyncRuns([]);
        });
    }
  }, [open, runningId]);

  useEffect(() => {
    if (runningId === null) {
      return;
    }
    const interval = window.setInterval(() => {
      void fetchSyncRun(runningId)
        .then((run) => {
          if (run.status !== 'running') {
            setRunningId(null);
            toast.success(`Sync ${run.status}: ${String(run.marketsUpserted)} markets`);
            void fetchSyncRuns(20).then((result) => {
              setSyncRuns(result.syncRuns);
            });
          }
        })
        .catch(() => {
          setRunningId(null);
        });
    }, 2000);
    return () => {
      window.clearInterval(interval);
    };
  }, [runningId]);

  async function handleSync() {
    if (hasUnsavedEdits) {
      toast.error('Save or discard sheet edits before syncing — sync overwrites manual changes.');
      return;
    }

    const parseFocus = (value: string): Focus[] =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part): part is Focus => FOCUS_VALUES.includes(part as Focus));

    try {
      const result = await startSync({
        provider: 'kalshi',
        ...(focusText.trim() ? { focus: parseFocus(focusText) } : {}),
        ...(excludeText.trim() ? { exclude: parseFocus(excludeText) } : {}),
        ...(full ? { full: true } : {}),
        ...(maxPages.trim() ? { maxPages: Number.parseInt(maxPages, 10) } : {}),
      });
      setRunningId(result.syncRunId);
      toast.info('Sync started');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sync failed');
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        aria-label="Close Admin Dialog"
        onClick={() => {
          onOpenChange(false);
        }}
      />
      <div className="bg-popover relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-medium">Sync & Admin</h2>
        <p className="text-muted-foreground mb-4 text-sm">API: {getApiBaseUrl()}</p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sync-focus">Focus (Comma-Separated)</Label>
            <Input
              id="sync-focus"
              value={focusText}
              onChange={(event) => {
                setFocusText(event.target.value);
              }}
              placeholder="politics,weather"
            />
          </div>
          <div>
            <Label htmlFor="sync-exclude">Exclude Focus</Label>
            <Input
              id="sync-exclude"
              value={excludeText}
              onChange={(event) => {
                setExcludeText(event.target.value);
              }}
              placeholder="sports"
            />
          </div>
          <div>
            <Label htmlFor="sync-max-pages">Max Pages</Label>
            <Input
              id="sync-max-pages"
              value={maxPages}
              onChange={(event) => {
                setMaxPages(event.target.value);
              }}
              placeholder="optional"
            />
          </div>
          <Checkbox checked={full} onCheckedChange={setFull} label="Full Sync (Mark Unseen Stale)" />
          <Button variant="save" onClick={() => void handleSync()} disabled={runningId !== null}>
            {runningId !== null ? `Syncing (#${String(runningId)})…` : 'Start Sync'}
          </Button>
        </div>

        <h3 className="mt-6 mb-2 font-medium">Recent Sync Runs</h3>
        <table className="comparison-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Markets</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {syncRuns.map((run) => (
              <tr key={run.id}>
                <td>{run.id}</td>
                <td>{run.status}</td>
                <td>{run.marketsUpserted}</td>
                <td>{formatDate(run.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SyncAdminButton({ hasUnsavedEdits }: { hasUnsavedEdits: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="header-toolbar-outline"
        onClick={() => {
          setOpen(true);
        }}
        aria-label="Open Admin Dialog"
      >
        <SettingsIcon className="size-4" />
      </Button>
      <SyncAdminDialog open={open} onOpenChange={setOpen} hasUnsavedEdits={hasUnsavedEdits} />
    </>
  );
}
