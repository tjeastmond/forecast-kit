'use client';

import { FOCUS_VALUES, type Focus, type MarketExportV1 } from '@/lib/constants';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MultiSelectFilter } from '@/components/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Label, Textarea } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetHeader } from '@/components/ui/sheet';
import {
  fetchMarketDetail,
  fetchMarketExport,
  getMarketExportUrl,
  patchMarket,
  updateFocusTags,
  type MarketDetail,
} from '@/lib/api';
import { formatDate, formatNumber, formatPrice, formatSpread } from '@/lib/format';

function ExportPreview({ exportData }: { exportData: MarketExportV1 }) {
  return (
    <div className="space-y-2 text-sm">
      <p>
        <span className="text-muted-foreground">Implied:</span> {formatPrice(exportData.pricing.impliedProbability)}
      </p>
      <p>
        <span className="text-muted-foreground">Spread:</span> {formatSpread(exportData.pricing.spread)} · Mid{' '}
        {formatPrice(exportData.pricing.midPrice)}
      </p>
      <p>
        <span className="text-muted-foreground">Volume:</span> {formatNumber(exportData.liquidity.volume)} · OI{' '}
        {formatNumber(exportData.liquidity.openInterest)}
      </p>
      <p>
        <span className="text-muted-foreground">Close:</span> {formatDate(exportData.timing.closeTime)}
      </p>
      {exportData.rules.primary ? (
        <p className="text-muted-foreground whitespace-pre-wrap">{exportData.rules.primary}</p>
      ) : null}
    </div>
  );
}

export function MarketDetailSheet({
  ticker,
  open,
  onOpenChange,
  onDirtyChange,
}: {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [exportData, setExportData] = useState<MarketExportV1 | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [status, setStatus] = useState('');
  const [yesBid, setYesBid] = useState('');
  const [yesAsk, setYesAsk] = useState('');
  const [noBid, setNoBid] = useState('');
  const [noAsk, setNoAsk] = useState('');
  const [lastPrice, setLastPrice] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [focusTags, setFocusTags] = useState<Set<Focus>>(new Set());
  const [showRawJson, setShowRawJson] = useState(false);

  const load = useCallback(async (marketTicker: string) => {
    setLoading(true);
    try {
      const [market, exportJson] = await Promise.all([
        fetchMarketDetail(marketTicker),
        fetchMarketExport(marketTicker),
      ]);
      setDetail(market);
      setExportData(exportJson);
      setTitle(market.title);
      setSubtitle(market.subtitle);
      setStatus(market.status);
      setYesBid(market.yesBid?.toString() ?? '');
      setYesAsk(market.yesAsk?.toString() ?? '');
      setNoBid(market.noBid?.toString() ?? '');
      setNoAsk(market.noAsk?.toString() ?? '');
      setLastPrice(market.lastPrice?.toString() ?? '');
      setIsStale(market.isStale);
      setFocusTags(new Set(market.focusTags));
      setEditMode(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load market');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && ticker) {
      void load(ticker);
    }
  }, [open, ticker, load]);

  const isDirty =
    detail !== null &&
    (title !== detail.title ||
      subtitle !== detail.subtitle ||
      status !== detail.status ||
      isStale !== detail.isStale ||
      yesBid !== (detail.yesBid?.toString() ?? '') ||
      yesAsk !== (detail.yesAsk?.toString() ?? '') ||
      noBid !== (detail.noBid?.toString() ?? '') ||
      noAsk !== (detail.noAsk?.toString() ?? '') ||
      lastPrice !== (detail.lastPrice?.toString() ?? '') ||
      [...focusTags].sort().join(',') !== [...detail.focusTags].sort().join(','));

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!ticker || !detail) {
      return;
    }
    try {
      const parseOptional = (value: string): number | null => {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        const parsed = Number.parseFloat(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      };

      await patchMarket(ticker, {
        title,
        subtitle,
        status,
        isStale,
        yesBid: parseOptional(yesBid),
        yesAsk: parseOptional(yesAsk),
        noBid: parseOptional(noBid),
        noAsk: parseOptional(noAsk),
        lastPrice: parseOptional(lastPrice),
      });
      await updateFocusTags(ticker, [...focusTags]);
      toast.success('Market updated');
      await load(ticker);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    }
  }, [ticker, detail, title, subtitle, status, isStale, yesBid, yesAsk, noBid, noAsk, lastPrice, focusTags, load]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's' && open && isDirty) {
        event.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isDirty, handleSave]);

  function handleClose() {
    if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) {
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
        } else {
          handleClose();
        }
      }}
    >
      <SheetContent onClose={handleClose}>
        <SheetHeader>
          <h2 className="text-base font-medium">{detail?.title ?? ticker ?? 'Market'}</h2>
          <p className="text-muted-foreground font-mono text-xs">{ticker}</p>
        </SheetHeader>
        <SheetBody>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
          {!loading && detail ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 font-medium">Agent Export Preview</h3>
                {exportData ? <ExportPreview exportData={exportData} /> : null}
                {ticker ? (
                  <a
                    href={getMarketExportUrl(ticker)}
                    className="text-blue-600 mt-2 inline-block text-sm dark:text-blue-400"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Export JSON
                  </a>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 font-medium">Sides</h3>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Side</th>
                      <th>Bid</th>
                      <th>Ask</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.sides.map((side) => (
                      <tr key={side.id}>
                        <td>{side.label}</td>
                        <td>{formatPrice(side.bid)}</td>
                        <td>{formatPrice(side.ask)}</td>
                        <td>{formatPrice(side.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section>
                <h3 className="mb-2 font-medium">Timing & Liquidity</h3>
                <div className="text-sm space-y-1">
                  <p>
                    Open {formatDate(detail.openTime)} · Close {formatDate(detail.closeTime)}
                  </p>
                  <p>
                    Volume {formatNumber(detail.volume)} · 24h {formatNumber(detail.volume24h)}
                  </p>
                  <p>
                    Liquidity {formatNumber(detail.liquidity)} · OI {formatNumber(detail.openInterest)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Updated {formatDate(detail.updatedAt)} · Last seen {formatDate(detail.lastSeenAt)}
                  </p>
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">Edit Fields</h3>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => {
                      setEditMode((current) => !current);
                    }}
                  >
                    {editMode ? 'Hide Editor' : 'Edit'}
                  </Button>
                </div>
                {editMode ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(event) => {
                          setTitle(event.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="subtitle">Subtitle</Label>
                      <Textarea
                        id="subtitle"
                        value={subtitle}
                        onChange={(event) => {
                          setSubtitle(event.target.value);
                        }}
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Input
                        id="status"
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="yesBid">Yes Bid</Label>
                        <Input
                          id="yesBid"
                          value={yesBid}
                          onChange={(event) => {
                            setYesBid(event.target.value);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="yesAsk">Yes Ask</Label>
                        <Input
                          id="yesAsk"
                          value={yesAsk}
                          onChange={(event) => {
                            setYesAsk(event.target.value);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="noBid">No Bid</Label>
                        <Input
                          id="noBid"
                          value={noBid}
                          onChange={(event) => {
                            setNoBid(event.target.value);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="noAsk">No Ask</Label>
                        <Input
                          id="noAsk"
                          value={noAsk}
                          onChange={(event) => {
                            setNoAsk(event.target.value);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastPrice">Last Price</Label>
                        <Input
                          id="lastPrice"
                          value={lastPrice}
                          onChange={(event) => {
                            setLastPrice(event.target.value);
                          }}
                        />
                      </div>
                    </div>
                    <Checkbox checked={isStale} onCheckedChange={setIsStale} label="Mark As Stale" />
                    <div>
                      <Label>Focus Tags</Label>
                      <MultiSelectFilter
                        items={FOCUS_VALUES.map((focus) => ({ value: focus, label: focus }))}
                        selected={focusTags}
                        onSelectedChange={setFocusTags}
                        emptyLabel="Select Focus Tags"
                        pluralNoun="tags"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="save" onClick={() => void handleSave()} disabled={!isDirty}>
                        Save
                      </Button>
                      <Button variant="cancelOutline" onClick={() => ticker && void load(ticker)}>
                        Reset
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section>
                <button
                  type="button"
                  className="text-sm font-medium"
                  onClick={() => {
                    setShowRawJson((current) => !current);
                  }}
                >
                  {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
                </button>
                {showRawJson ? (
                  <pre className="bg-muted mt-2 overflow-x-auto rounded-lg p-3 text-xs">{detail.rawJson}</pre>
                ) : null}
              </section>
            </div>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
