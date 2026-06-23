'use client';

import { CopyIcon } from 'lucide-react';
import { type MarketExportV1 } from '@/lib/constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { fetchMarketDetail, fetchMarketExport, getMarketExportUrl, type MarketDetail } from '@/lib/api';
import { formatDate, formatNumber, formatPrice, formatSpread } from '@/lib/format';

function formatRawJsonForDisplay(rawJson: string): string {
  try {
    return JSON.stringify(JSON.parse(rawJson) as unknown, null, 2);
  } catch {
    return rawJson;
  }
}

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
        <div className="border-border -mx-4 border-b px-4 pt-2 pb-6">
          <p className="whitespace-pre-wrap">{exportData.rules.primary}</p>
        </div>
      ) : null}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </>
  );
}

function TimingLiquiditySection({ detail }: { detail: MarketDetail }) {
  return (
    <section className="border-border -mx-4 border-b px-4 pb-6">
      <h3 className="mb-3 font-medium">Timing & Liquidity</h3>
      <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-6 gap-y-2.5 text-sm">
        <StatRow label="Open" value={formatDate(detail.openTime)} />
        <StatRow label="Close" value={formatDate(detail.closeTime)} />
        <StatRow label="Volume" value={formatNumber(detail.volume)} />
        <StatRow label="24h Volume" value={formatNumber(detail.volume24h)} />
        <StatRow label="Liquidity" value={formatNumber(detail.liquidity)} />
        <StatRow label="Open Interest" value={formatNumber(detail.openInterest)} />
      </dl>
      <p className="text-muted-foreground mt-4 text-xs tabular-nums">
        Updated {formatDate(detail.updatedAt)} · Last seen {formatDate(detail.lastSeenAt)}
      </p>
    </section>
  );
}

export function MarketDetailSheet({
  ticker,
  open,
  onOpenChange,
}: {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<MarketDetail | null>(null);
  const [exportData, setExportData] = useState<MarketExportV1 | null>(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    if (!open) {
      setShowRawJson(false);
    }
  }, [open]);

  const formattedRawJson = useMemo(() => (detail ? formatRawJsonForDisplay(detail.rawJson) : ''), [detail]);

  const copyTicker = useCallback(async (marketTicker: string) => {
    try {
      await navigator.clipboard.writeText(marketTicker);
      toast.success('Market ID copied');
    } catch {
      toast.error('Failed to copy market ID');
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onClose={() => {
          onOpenChange(false);
        }}
      >
        <SheetHeader>
          <h2 className="text-base font-medium">{detail?.title ?? ticker ?? 'Market'}</h2>
          {ticker ? (
            <div className="flex items-center gap-1">
              <p className="text-muted-foreground font-mono text-xs">{ticker}</p>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-6"
                aria-label="Copy ID"
                onClick={() => {
                  void copyTicker(ticker);
                }}
              >
                <CopyIcon className="size-3.5" />
              </Button>
            </div>
          ) : null}
        </SheetHeader>
        <SheetBody>
          {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
          {!loading && detail ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-2 font-medium">Agent Export Preview</h3>
                {exportData ? <ExportPreview exportData={exportData} /> : null}
              </section>

              <TimingLiquiditySection detail={detail} />

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

              <section className="border-border -mx-4 border-t px-4 pt-6">
                <Button
                  variant="outline"
                  className="bg-muted/70 hover:bg-muted"
                  onClick={() => {
                    setShowRawJson((current) => !current);
                  }}
                >
                  {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
                </Button>
                {showRawJson ? (
                  <pre className="bg-muted mt-3 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {formattedRawJson}
                  </pre>
                ) : null}
              </section>
            </div>
          ) : null}
        </SheetBody>
        {ticker ? (
          <SheetFooter>
            <Button
              onClick={() => {
                window.open(getMarketExportUrl(ticker), '_blank', 'noopener,noreferrer');
              }}
            >
              Open Export JSON
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
