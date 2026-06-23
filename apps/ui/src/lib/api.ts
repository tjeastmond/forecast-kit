import type { Focus, MarketExportV1 } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_FORCAST_KIT_API_URL ?? '/api';

export interface MarketSummary {
  readonly id: number;
  readonly ticker: string;
  readonly eventTicker: string;
  readonly title: string;
  readonly status: string;
  readonly closeTime: string;
  readonly category: string | null;
  readonly focusTags: readonly Focus[];
  readonly volume: number;
  readonly lastPrice: number | null;
  readonly isStale: boolean;
}

export interface MarketComparisonRow extends MarketSummary {
  readonly volume24h: number;
  readonly liquidity: number;
  readonly openInterest: number;
  readonly yesBid: number | null;
  readonly yesAsk: number | null;
  readonly spread: number | null;
  readonly midPrice: number | null;
  readonly impliedProbability: number | null;
}

export interface MarketListResponse {
  readonly markets: readonly MarketSummary[];
  readonly cursor: string | null;
}

export interface MarketSide {
  readonly id: number;
  readonly label: string;
  readonly side: string;
  readonly bid: number | null;
  readonly ask: number | null;
  readonly price: number | null;
}

export interface MarketDetail {
  readonly id: number;
  readonly ticker: string;
  readonly eventTicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: string;
  readonly category: string | null;
  readonly yesBid: number | null;
  readonly yesAsk: number | null;
  readonly noBid: number | null;
  readonly noAsk: number | null;
  readonly lastPrice: number | null;
  readonly volume: number;
  readonly volume24h: number;
  readonly liquidity: number;
  readonly openInterest: number;
  readonly openTime: string;
  readonly closeTime: string;
  readonly expirationTime: string | null;
  readonly rulesPrimary: string | null;
  readonly rulesSecondary: string | null;
  readonly rawJson: string;
  readonly isStale: boolean;
  readonly updatedAt: string;
  readonly lastSeenAt: string;
  readonly focusTags: readonly Focus[];
  readonly sides: readonly MarketSide[];
  readonly metrics?: {
    readonly spread: number | null;
    readonly midPrice: number | null;
    readonly impliedProbability: number | null;
  };
}

export interface EventRow {
  readonly id: number;
  readonly eventTicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly category: string | null;
  readonly markets?: readonly MarketSummary[];
}

export interface EventListResponse {
  readonly events: readonly EventRow[];
  readonly cursor: string | null;
}

export interface EventDetailResponse extends EventRow {
  readonly markets: readonly MarketComparisonRow[];
}

export interface SyncRunRow {
  readonly id: number;
  readonly provider: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly status: string;
  readonly eventsUpserted: number;
  readonly marketsUpserted: number;
  readonly errorsCount: number;
  readonly errorSummary: string | null;
}

export interface SyncRunListResponse {
  readonly syncRuns: readonly SyncRunRow[];
  readonly cursor: string | null;
}

export interface MarketPatchBody {
  readonly title?: string;
  readonly subtitle?: string;
  readonly status?: string;
  readonly yesBid?: number | null;
  readonly yesAsk?: number | null;
  readonly noBid?: number | null;
  readonly noAsk?: number | null;
  readonly lastPrice?: number | null;
  readonly isStale?: boolean;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${String(response.status)})`);
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function fetchMarkets(options: {
  focus?: string;
  exclude?: string;
  status?: string;
  stale?: boolean;
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<MarketListResponse> {
  return apiFetch(
    `/markets${buildQuery({
      focus: options.focus,
      exclude: options.exclude,
      status: options.status,
      stale: options.stale === undefined ? undefined : String(options.stale),
      q: options.q,
      limit: options.limit?.toString(),
      cursor: options.cursor,
    })}`,
  );
}

export async function fetchMarketDetail(ticker: string): Promise<MarketDetail> {
  return apiFetch(`/markets/${encodeURIComponent(ticker)}?includeMetrics=true`);
}

export async function fetchMarketExport(ticker: string): Promise<MarketExportV1> {
  return apiFetch(`/markets/${encodeURIComponent(ticker)}/export`);
}

export async function fetchEvents(options: {
  focus?: string;
  exclude?: string;
  q?: string;
  limit?: number;
  cursor?: string;
  includeMarkets?: boolean;
}): Promise<EventListResponse> {
  return apiFetch(
    `/events${buildQuery({
      focus: options.focus,
      exclude: options.exclude,
      q: options.q,
      limit: options.limit?.toString(),
      cursor: options.cursor,
      includeMarkets: options.includeMarkets === true ? 'true' : undefined,
    })}`,
  );
}

export async function fetchEventDetail(eventTicker: string): Promise<EventDetailResponse> {
  return apiFetch(`/events/${encodeURIComponent(eventTicker)}?includeMetrics=true`);
}

export async function patchMarket(ticker: string, body: MarketPatchBody): Promise<MarketDetail> {
  return apiFetch(`/admin/markets/${encodeURIComponent(ticker)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function updateFocusTags(ticker: string, focusTags: readonly Focus[]): Promise<MarketDetail> {
  return apiFetch(`/admin/markets/${encodeURIComponent(ticker)}/focus-tags`, {
    method: 'PUT',
    body: JSON.stringify({ focusTags }),
  });
}

export async function startSync(body: {
  provider?: string;
  focus?: readonly Focus[];
  exclude?: readonly Focus[];
  full?: boolean;
  maxPages?: number;
}): Promise<{ syncRunId: number; status: string }> {
  return apiFetch('/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function startEventSync(
  eventTicker: string,
  body: { provider?: string } = {},
): Promise<{ syncRunId: number; status: string; eventTicker: string }> {
  return apiFetch(`/events/${encodeURIComponent(eventTicker)}/sync`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSyncRun(id: number): Promise<SyncRunRow> {
  return apiFetch(`/sync/${String(id)}`);
}

export async function fetchSyncRuns(limit = 20): Promise<SyncRunListResponse> {
  return apiFetch(`/sync?limit=${String(limit)}`);
}

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function getMarketExportUrl(ticker: string): string {
  return `${API_BASE}/markets/${encodeURIComponent(ticker)}/export`;
}
