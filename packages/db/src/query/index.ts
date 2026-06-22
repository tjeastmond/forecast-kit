import type { Focus } from '@forcast-kit/core';
import { and, asc, eq, gt, inArray, like, notInArray, or } from 'drizzle-orm';
import type { DatabaseClient } from '../database-client.js';
import { events, marketFocusTags, marketSides, markets, syncRuns } from '../schema/index.js';
import type { MarketRow, SyncRunRow } from '../schema/index.js';

export interface MarketListOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly status?: string;
  readonly q?: string;
  readonly eventTicker?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface MarketSummary {
  readonly id: number;
  readonly ticker: string;
  readonly title: string;
  readonly status: string;
  readonly closeTime: string;
  readonly category: string | null;
  readonly focusTags: readonly Focus[];
  readonly volume: number;
  readonly lastPrice: number | null;
}

export interface MarketListResult {
  readonly markets: readonly MarketSummary[];
  readonly cursor: string | null;
}

export interface MarketDetail extends MarketRow {
  readonly focusTags: readonly Focus[];
  readonly sides: readonly (typeof marketSides.$inferSelect)[];
  readonly event: typeof events.$inferSelect | null;
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

export class MarketQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async getEventTickersMatchingFilter(options: Pick<MarketListOptions, 'focus' | 'exclude'>): Promise<string[]> {
    const whereParts = [];

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
    if (options.eventTicker) {
      whereParts.push(eq(markets.eventTicker, options.eventTicker));
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

    const summaries: MarketSummary[] = pageRows.map((row) => ({
      id: row.id,
      ticker: row.ticker,
      title: row.title,
      status: row.status,
      closeTime: row.closeTime,
      category: row.category,
      focusTags: tagMap.get(row.id) ?? [],
      volume: row.volume,
      lastPrice: row.lastPrice,
    }));

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null;

    return { markets: summaries, cursor: nextCursor };
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

    return {
      ...market,
      focusTags: tagRows.map((row) => row.focus as Focus),
      sides,
      event: event ?? null,
    };
  }
}

export interface EventListOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly q?: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly includeMarkets?: boolean;
}

export class EventQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async listEvents(options: EventListOptions = {}) {
    const limit = clampLimit(options.limit);
    const whereParts = [];

    if (options.q) {
      const pattern = `%${options.q}%`;
      whereParts.push(or(like(events.title, pattern), like(events.eventTicker, pattern)));
    }

    if (options.cursor) {
      const cursorId = decodeCursor(options.cursor);
      if (cursorId !== null) {
        whereParts.push(gt(events.id, cursorId));
      }
    }

    if (options.focus?.length || options.exclude?.length) {
      const marketQuery = new MarketQueryService(this._db);
      const eventTickers = await marketQuery.getEventTickersMatchingFilter({
        ...(options.focus !== undefined ? { focus: options.focus } : {}),
        ...(options.exclude !== undefined ? { exclude: options.exclude } : {}),
      });
      if (eventTickers.length === 0) {
        return { events: [], cursor: null };
      }
      whereParts.push(inArray(events.eventTicker, eventTickers));
    }

    const whereClause = whereParts.length > 0 ? and(...whereParts) : undefined;

    const rows = await this._db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(asc(events.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const marketQuery = new MarketQueryService(this._db);

    const result = [];
    for (const event of pageRows) {
      const entry: Record<string, unknown> = { ...event };
      if (options.includeMarkets) {
        const { markets: eventMarkets } = await marketQuery.listMarkets({
          eventTicker: event.eventTicker,
          ...(options.focus !== undefined ? { focus: options.focus } : {}),
          ...(options.exclude !== undefined ? { exclude: options.exclude } : {}),
          limit: MAX_LIMIT,
        });
        entry['markets'] = eventMarkets;
      }
      result.push(entry);
    }

    const lastRow = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.id) : null;
    return { events: result, cursor: nextCursor };
  }

  async getEventByTicker(eventTicker: string, options: { focus?: Focus[]; exclude?: Focus[] } = {}) {
    const [event] = await this._db.select().from(events).where(eq(events.eventTicker, eventTicker)).limit(1);
    if (!event) {
      return null;
    }

    const marketQuery = new MarketQueryService(this._db);
    const { markets: eventMarkets } = await marketQuery.listMarkets({
      eventTicker,
      ...(options.focus !== undefined ? { focus: options.focus } : {}),
      ...(options.exclude !== undefined ? { exclude: options.exclude } : {}),
      limit: MAX_LIMIT,
    });

    return {
      ...event,
      markets: eventMarkets,
    };
  }
}

export class SyncRunQueryService {
  constructor(private readonly _db: DatabaseClient) {}

  async getById(id: number): Promise<SyncRunRow | null> {
    const [row] = await this._db.select().from(syncRuns).where(eq(syncRuns.id, id)).limit(1);
    return row ?? null;
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
