import type { Focus, ProviderId } from '@forecast-kit/core';
import { deriveMarketMetrics, pickDefined } from '@forecast-kit/core';
import { and, asc, desc, eq, gt, inArray, like, lt, notInArray, or, sql } from 'drizzle-orm';
import type { DatabaseClient } from '../database-client.js';
import { PinRepository } from '../repositories/index.js';
import { events, marketFocusTags, marketSides, markets, syncRuns } from '../schema/index.js';
import type { MarketRow, SyncRunRow } from '../schema/index.js';

export type { SyncRunRow };

export interface MarketListOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly category?: string;
  readonly tag?: string;
  readonly status?: string;
  readonly stale?: boolean;
  readonly q?: string;
  readonly eventTicker?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface MarketSummary {
  readonly id: number;
  readonly ticker: string;
  readonly eventTicker: string;
  readonly title: string;
  readonly subtitle: string;
  readonly status: string;
  readonly closeTime: string;
  readonly category: string | null;
  readonly focusTags: readonly Focus[];
  readonly volume: number;
  readonly lastPrice: number | null;
  readonly isStale: boolean;
  readonly isPinned: boolean;
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

export interface MarketListResult {
  readonly markets: readonly MarketSummary[];
  readonly cursor: string | null;
}

export interface MarketDetail extends MarketRow {
  readonly focusTags: readonly Focus[];
  readonly sides: readonly (typeof marketSides.$inferSelect)[];
  readonly event: typeof events.$inferSelect | null;
  readonly isPinned: boolean;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function encodeCursor(id: number): string {
  return Buffer.from(String(id)).toString('base64url');
}

function decodeCursor(cursor: string): number | null {
  const parsed = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(1, limit), MAX_LIMIT);
}

async function loadFocusTagsForMarkets(
  db: DatabaseClient,
  marketIds: readonly number[],
): Promise<Map<number, Focus[]>> {
  const tagMap = new Map<number, Focus[]>();
  if (marketIds.length === 0) {
    return tagMap;
  }

  const rows = await db
    .select({ marketId: marketFocusTags.marketId, focus: marketFocusTags.focus })
    .from(marketFocusTags)
    .where(inArray(marketFocusTags.marketId, [...marketIds]));

  for (const row of rows) {
    const existing = tagMap.get(row.marketId) ?? [];
    existing.push(row.focus as Focus);
    tagMap.set(row.marketId, existing);
  }

  return tagMap;
}

async function loadPinnedStateForMarkets(
  db: DatabaseClient,
  marketRows: readonly { readonly provider: string; readonly ticker: string }[],
): Promise<Set<string>> {
  const pinned = new Set<string>();
  if (marketRows.length === 0) {
    return pinned;
  }

  const byProvider = new Map<ProviderId, string[]>();
  for (const row of marketRows) {
    const provider = row.provider as ProviderId;
    const tickers = byProvider.get(provider) ?? [];
    tickers.push(row.ticker);
    byProvider.set(provider, tickers);
  }

  const pinRepo = new PinRepository(db);
  for (const [provider, tickers] of byProvider) {
    const providerPinned = await pinRepo.getPinnedMarketTickers(provider, tickers);
    for (const ticker of providerPinned) {
      pinned.add(ticker);
    }
  }

  return pinned;
}

function withMarketPinState<T extends MarketSummary>(summaries: readonly T[], pinnedTickers: ReadonlySet<string>): T[] {
  return summaries.map((summary) => ({
    ...summary,
    isPinned: pinnedTickers.has(summary.ticker),
  }));
}

async function enrichEventsWithPinState(
  db: DatabaseClient,
  eventRows: readonly (typeof events.$inferSelect)[],
): Promise<
  Array<
    typeof events.$inferSelect & {
      isPinned: boolean;
      isDirectlyPinned: boolean;
      pinnedAt: string | null;
    }
  >
> {
  if (eventRows.length === 0) {
    return [];
  }

  const providers = [...new Set(eventRows.map((row) => row.provider as ProviderId))];
  const pinnedAtByEvent = new Map<string, string>();
  const directlyPinned = new Set<string>();

  for (const provider of providers) {
    const tickersForProvider = eventRows.filter((row) => row.provider === provider).map((row) => row.eventTicker);
    const pinnedAtMap = await new PinRepository(db).getPinnedAtByEventTicker(provider, tickersForProvider);
    for (const [eventTicker, pinnedAt] of pinnedAtMap) {
      pinnedAtByEvent.set(`${provider}:${eventTicker}`, pinnedAt);
    }
    const directSet = await new PinRepository(db).getDirectlyPinnedEventTickers(provider, tickersForProvider);
    for (const eventTicker of directSet) {
      directlyPinned.add(`${provider}:${eventTicker}`);
    }
  }

  return eventRows.map((event) => {
    const key = `${event.provider}:${event.eventTicker}`;
    const pinnedAt = pinnedAtByEvent.get(key) ?? null;
    return {
      ...event,
      isPinned: pinnedAt !== null,
      isDirectlyPinned: directlyPinned.has(key),
      pinnedAt,
    };
  });
}

async function enrichSingleEvent(
  db: DatabaseClient,
  event: typeof events.$inferSelect,
): Promise<
  typeof events.$inferSelect & {
    isPinned: boolean;
    isDirectlyPinned: boolean;
    pinnedAt: string | null;
  }
> {
  const enriched = await enrichEventsWithPinState(db, [event]);
  const enrichedEvent = enriched[0];
  if (!enrichedEvent) {
    throw new Error(`Failed to enrich event ${event.eventTicker}`);
  }
  return enrichedEvent;
}

export class MarketQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async getEventTickersMatchingFilter(
    options: Pick<MarketListOptions, 'focus' | 'exclude' | 'category' | 'tag' | 'status' | 'stale'>,
  ): Promise<string[]> {
    const whereParts = [];

    if (options.status) {
      whereParts.push(eq(markets.status, options.status));
    }
    if (options.category) {
      whereParts.push(eq(markets.category, options.category));
    }
    if (options.tag) {
      whereParts.push(
        sql`EXISTS (SELECT 1 FROM json_each(${markets.seriesTagsJson}) WHERE json_each.value = ${options.tag})`,
      );
    }
    if (options.stale !== undefined) {
      whereParts.push(eq(markets.isStale, options.stale));
    }

    if (options.focus && options.focus.length > 0) {
      whereParts.push(
        inArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.focus])),
        ),
      );
    }

    if (options.exclude && options.exclude.length > 0) {
      whereParts.push(
        notInArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.exclude])),
        ),
      );
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const rows = await this._db.selectDistinct({ eventTicker: markets.eventTicker }).from(markets).where(whereClause);

    return rows.map((row) => row.eventTicker);
  }

  async listMarkets(options: MarketListOptions = {}): Promise<MarketListResult> {
    const limit = clampLimit(options.limit);
    const whereParts = [];

    if (options.status) {
      whereParts.push(eq(markets.status, options.status));
    }
    if (options.stale !== undefined) {
      whereParts.push(eq(markets.isStale, options.stale));
    }
    if (options.eventTicker) {
      whereParts.push(eq(markets.eventTicker, options.eventTicker));
    }
    if (options.category) {
      whereParts.push(eq(markets.category, options.category));
    }
    if (options.tag) {
      whereParts.push(
        sql`EXISTS (SELECT 1 FROM json_each(${markets.seriesTagsJson}) WHERE json_each.value = ${options.tag})`,
      );
    }
    if (options.q) {
      const pattern = `%${options.q}%`;
      whereParts.push(or(like(markets.title, pattern), like(markets.ticker, pattern)));
    }
    if (options.cursor) {
      const cursorId = decodeCursor(options.cursor);
      if (cursorId !== null) {
        whereParts.push(gt(markets.id, cursorId));
      }
    }
    if (options.focus && options.focus.length > 0) {
      whereParts.push(
        inArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.focus])),
        ),
      );
    }
    if (options.exclude && options.exclude.length > 0) {
      whereParts.push(
        notInArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.exclude])),
        ),
      );
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const rows = await this._db
      .select()
      .from(markets)
      .where(whereClause)
      .orderBy(asc(markets.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const tagMap = await loadFocusTagsForMarkets(
      this._db,
      pageRows.map((row) => row.id),
    );
    const pinnedTickers = await loadPinnedStateForMarkets(this._db, pageRows);

    const summaries: MarketSummary[] = withMarketPinState(
      pageRows.map((row) => ({
        id: row.id,
        ticker: row.ticker,
        eventTicker: row.eventTicker,
        title: row.title,
        subtitle: row.subtitle,
        status: row.status,
        closeTime: row.closeTime,
        category: row.category,
        focusTags: tagMap.get(row.id) ?? [],
        volume: row.volume,
        lastPrice: row.lastPrice,
        isStale: row.isStale,
        isPinned: false,
      })),
      pinnedTickers,
    );

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null;

    return { markets: summaries, cursor: nextCursor };
  }

  async listMarketsForEventTickers(
    eventTickers: readonly string[],
    options: Pick<MarketListOptions, 'focus' | 'exclude' | 'category' | 'tag' | 'status' | 'stale'> = {},
  ): Promise<Map<string, MarketSummary[]>> {
    const grouped = new Map<string, MarketSummary[]>();
    if (eventTickers.length === 0) {
      return grouped;
    }

    const whereParts = [inArray(markets.eventTicker, [...eventTickers])];

    if (options.status) {
      whereParts.push(eq(markets.status, options.status));
    }
    if (options.stale !== undefined) {
      whereParts.push(eq(markets.isStale, options.stale));
    }
    if (options.category) {
      whereParts.push(eq(markets.category, options.category));
    }
    if (options.tag) {
      whereParts.push(
        sql`EXISTS (SELECT 1 FROM json_each(${markets.seriesTagsJson}) WHERE json_each.value = ${options.tag})`,
      );
    }
    if (options.focus && options.focus.length > 0) {
      whereParts.push(
        inArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.focus])),
        ),
      );
    }
    if (options.exclude && options.exclude.length > 0) {
      whereParts.push(
        notInArray(
          markets.id,
          this._db
            .select({ id: marketFocusTags.marketId })
            .from(marketFocusTags)
            .where(inArray(marketFocusTags.focus, [...options.exclude])),
        ),
      );
    }

    const rows = await this._db
      .select()
      .from(markets)
      .where(and(...whereParts))
      .orderBy(asc(markets.id))
      .limit(eventTickers.length * MAX_LIMIT);

    const tagMap = await loadFocusTagsForMarkets(
      this._db,
      rows.map((row) => row.id),
    );
    const pinnedTickers = await loadPinnedStateForMarkets(this._db, rows);

    for (const row of rows) {
      const summary: MarketSummary = {
        id: row.id,
        ticker: row.ticker,
        eventTicker: row.eventTicker,
        title: row.title,
        subtitle: row.subtitle,
        status: row.status,
        closeTime: row.closeTime,
        category: row.category,
        focusTags: tagMap.get(row.id) ?? [],
        volume: row.volume,
        lastPrice: row.lastPrice,
        isStale: row.isStale,
        isPinned: pinnedTickers.has(row.ticker),
      };
      const list = grouped.get(row.eventTicker) ?? [];
      list.push(summary);
      grouped.set(row.eventTicker, list);
    }

    return grouped;
  }

  async getMarketByTicker(ticker: string): Promise<MarketDetail | null> {
    const [market] = await this._db.select().from(markets).where(eq(markets.ticker, ticker)).limit(1);
    if (!market) {
      return null;
    }

    const sides = await this._db.select().from(marketSides).where(eq(marketSides.marketId, market.id));
    const tagRows = await this._db
      .select({ focus: marketFocusTags.focus })
      .from(marketFocusTags)
      .where(eq(marketFocusTags.marketId, market.id));

    const [event] = await this._db.select().from(events).where(eq(events.eventTicker, market.eventTicker)).limit(1);

    const pinnedTickers = await loadPinnedStateForMarkets(this._db, [market]);

    return {
      ...market,
      focusTags: tagRows.map((row) => row.focus as Focus),
      sides,
      event: event ?? null,
      isPinned: pinnedTickers.has(market.ticker),
    };
  }
}

export interface EventListOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly category?: string;
  readonly tag?: string;
  readonly status?: string;
  readonly stale?: boolean;
  readonly q?: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly includeMarkets?: boolean;
  readonly pinned?: boolean;
}

export class EventQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async listEvents(options: EventListOptions = {}) {
    const limit = clampLimit(options.limit);
    const whereParts = [];
    const pinRepo = new PinRepository(this._db);
    const hasMarketFilters = Boolean(
      options.focus?.length ||
      options.exclude?.length ||
      options.category ||
      options.tag ||
      options.status ||
      options.stale !== undefined,
    );

    if (options.pinned === true) {
      const pinnedTickers = await pinRepo.getPinnedEventTickers('kalshi');
      if (pinnedTickers.length === 0) {
        return { events: [], cursor: null };
      }
      whereParts.push(inArray(events.eventTicker, pinnedTickers));
    }

    if (options.q) {
      const pattern = `%${options.q}%`;
      whereParts.push(or(like(events.title, pattern), like(events.eventTicker, pattern)));
    }

    if (options.pinned !== true && options.cursor) {
      const cursorId = decodeCursor(options.cursor);
      if (cursorId !== null) {
        whereParts.push(gt(events.id, cursorId));
      }
    }

    let marketQuery: MarketQueryService | undefined;
    if (hasMarketFilters || options.includeMarkets) {
      marketQuery = new MarketQueryService(this._db);
    }

    const marketFilterOptions = pickDefined({
      focus: options.focus,
      exclude: options.exclude,
      category: options.category,
      tag: options.tag,
      status: options.status,
      stale: options.stale,
    });

    if (hasMarketFilters && marketQuery) {
      const eventTickers = await marketQuery.getEventTickersMatchingFilter(marketFilterOptions);
      if (eventTickers.length === 0) {
        return { events: [], cursor: null };
      }
      whereParts.push(inArray(events.eventTicker, eventTickers));
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    let pageRows: (typeof events.$inferSelect)[];
    let nextCursor: string | null = null;

    if (options.pinned === true) {
      const rows = await this._db.select().from(events).where(whereClause).orderBy(asc(events.id));
      const pinnedAtMap = await pinRepo.getPinnedAtByEventTicker(
        'kalshi',
        rows.map((event) => event.eventTicker),
      );
      const sortedRows = [...rows].sort((left, right) => {
        const leftPinnedAt = pinnedAtMap.get(left.eventTicker) ?? '';
        const rightPinnedAt = pinnedAtMap.get(right.eventTicker) ?? '';
        if (leftPinnedAt !== rightPinnedAt) {
          return rightPinnedAt.localeCompare(leftPinnedAt);
        }
        return left.id - right.id;
      });
      pageRows = sortedRows.slice(0, limit);
    } else {
      const rows = await this._db
        .select()
        .from(events)
        .where(whereClause)
        .orderBy(asc(events.id))
        .limit(limit + 1);
      const hasMore = rows.length > limit;
      pageRows = hasMore ? rows.slice(0, limit) : rows;
      const lastRow = pageRows[pageRows.length - 1];
      nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null;
    }

    let marketsByEvent: Map<string, MarketSummary[]> | undefined;
    if (options.includeMarkets && pageRows.length > 0 && marketQuery) {
      marketsByEvent = await marketQuery.listMarketsForEventTickers(
        pageRows.map((event) => event.eventTicker),
        marketFilterOptions,
      );
    }

    const enrichedEvents = await enrichEventsWithPinState(this._db, pageRows);

    const result = enrichedEvents.map((event) => {
      if (!options.includeMarkets) {
        return event;
      }
      return {
        ...event,
        markets: marketsByEvent?.get(event.eventTicker) ?? [],
      };
    });

    return { events: result, cursor: nextCursor };
  }

  async getEventByTicker(
    eventTicker: string,
    options: { focus?: Focus[]; exclude?: Focus[]; includeMetrics?: boolean } = {},
  ) {
    const [event] = await this._db.select().from(events).where(eq(events.eventTicker, eventTicker)).limit(1);
    if (!event) {
      return null;
    }

    const marketQuery = new MarketQueryService(this._db);
    const { markets: eventMarkets } = await marketQuery.listMarkets({
      eventTicker,
      ...pickDefined({
        focus: options.focus,
        exclude: options.exclude,
      }),
      limit: MAX_LIMIT,
    });

    if (!options.includeMetrics) {
      const enrichedEvent = await enrichSingleEvent(this._db, event);
      return {
        ...enrichedEvent,
        markets: eventMarkets,
      };
    }

    const tickers = eventMarkets.map((market) => market.ticker);
    if (tickers.length === 0) {
      const enrichedEvent = await enrichSingleEvent(this._db, event);
      return {
        ...enrichedEvent,
        markets: [] as MarketComparisonRow[],
      };
    }

    const rows = await this._db.select().from(markets).where(inArray(markets.ticker, tickers));
    const rowByTicker = new Map(rows.map((row) => [row.ticker, row]));
    const comparisonMarkets: MarketComparisonRow[] = eventMarkets.flatMap((summary) => {
      const row = rowByTicker.get(summary.ticker);
      if (!row) {
        return [];
      }
      const metrics = deriveMarketMetrics({
        yesBid: row.yesBid,
        yesAsk: row.yesAsk,
        noBid: row.noBid,
        noAsk: row.noAsk,
        lastPrice: row.lastPrice,
      });
      return [
        {
          ...summary,
          volume24h: row.volume24h,
          liquidity: row.liquidity,
          openInterest: row.openInterest,
          yesBid: row.yesBid,
          yesAsk: row.yesAsk,
          spread: metrics.spread,
          midPrice: metrics.midPrice,
          impliedProbability: metrics.impliedProbability,
        },
      ];
    });

    const enrichedEvent = await enrichSingleEvent(this._db, event);

    return {
      ...enrichedEvent,
      markets: comparisonMarkets,
    };
  }
}

export interface SyncRunListOptions {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface SyncRunListResult {
  readonly syncRuns: readonly SyncRunRow[];
  readonly cursor: string | null;
}

export class SyncRunQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async getById(id: number): Promise<SyncRunRow | null> {
    const [row] = await this._db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1);
    return row ?? null;
  }

  async listRuns(options: SyncRunListOptions = {}): Promise<SyncRunListResult> {
    const limit = clampLimit(options.limit);
    const whereParts = [];

    if (options.cursor) {
      const cursorId = decodeCursor(options.cursor);
      if (cursorId !== null) {
        whereParts.push(lt(syncRuns.id, cursorId));
      }
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const rows = await this._db
      .select()
      .from(syncRuns)
      .where(whereClause)
      .orderBy(desc(syncRuns.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null;

    return { syncRuns: pageRows, cursor: nextCursor };
  }
}

export function createQueryServices(db: DatabaseClient) {
  return {
    markets: new MarketQueryService(db),
    events: new EventQueryService(db),
    syncRuns: new SyncRunQueryService(db),
  };
}

export type QueryServices = ReturnType<typeof createQueryServices>;
