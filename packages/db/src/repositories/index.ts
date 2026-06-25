import type {
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  ProviderId,
  SeriesMetadata,
  SyncRunStatus,
} from '@forecast-kit/core';
import { pickDefined } from '@forecast-kit/core';
import type { Focus } from '@forecast-kit/core';
import { and, eq, inArray, isNotNull, notInArray, or, desc, sql } from 'drizzle-orm';
import {
  events,
  marketFocusTags,
  marketSides,
  markets,
  pinnedItems,
  providerCategories,
  providerCategoryTags,
  providerSeries,
  syncRuns,
  syncState,
} from '../schema/index.js';
import type { DatabaseClient } from '../database-client.js';

function isoNow(): string {
  return new Date().toISOString();
}

function toIsoDate(date: Date): string {
  return date.toISOString();
}

function parseTagsJson(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // invalid JSON — treat as empty tags
  }
  return [];
}

export class EventRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async upsert(event: NormalizedEvent): Promise<number> {
    const now = isoNow();
    const values = {
      provider: event.provider,
      externalEventId: event.externalEventId,
      eventTicker: event.eventTicker,
      seriesTicker: event.seriesTicker,
      title: event.title,
      subtitle: event.subtitle,
      category: event.category,
      settlementSourcesJson: JSON.stringify(event.settlementSources),
      rawJson: JSON.stringify(event.rawJson),
      updatedAt: now,
      lastSeenAt: now,
    };

    const [row] = await this._db
      .insert(events)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({
        target: [events.provider, events.eventTicker],
        set: values,
      })
      .returning({ id: events.id });

    if (!row) {
      throw new Error(`Failed to upsert event ${event.eventTicker}`);
    }

    return row.id;
  }
}

export class MarketRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async upsert(market: NormalizedMarket, options?: { seriesTags?: readonly string[] }): Promise<number> {
    const now = isoNow();
    const values = {
      provider: market.provider,
      externalMarketId: market.externalMarketId,
      ticker: market.ticker,
      eventTicker: market.eventTicker,
      seriesTicker: market.seriesTicker,
      title: market.title,
      subtitle: market.subtitle,
      category: market.category,
      marketType: market.marketType,
      status: market.status,
      closeTime: toIsoDate(market.closeTime),
      expirationTime: market.expirationTime ? toIsoDate(market.expirationTime) : null,
      openTime: toIsoDate(market.openTime),
      volume: market.volume,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      openInterest: market.openInterest,
      yesBid: market.yesBid,
      yesAsk: market.yesAsk,
      noBid: market.noBid,
      noAsk: market.noAsk,
      lastPrice: market.lastPrice,
      rulesPrimary: market.rulesPrimary,
      rulesSecondary: market.rulesSecondary,
      seriesTagsJson: JSON.stringify(options?.seriesTags ?? []),
      rawJson: JSON.stringify(market.rawJson),
      updatedAt: now,
      lastSeenAt: now,
      isStale: false,
    };

    const [row] = await this._db
      .insert(markets)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({
        target: [markets.provider, markets.ticker],
        set: values,
      })
      .returning({ id: markets.id });

    if (!row) {
      throw new Error(`Failed to upsert market ${market.ticker}`);
    }

    return row.id;
  }

  async markStaleExcept(provider: ProviderId, seenMarketIds: ReadonlySet<number>): Promise<void> {
    const now = isoNow();
    const seenIds = [...seenMarketIds];

    if (seenIds.length === 0) {
      await this._db.update(markets).set({ isStale: true, updatedAt: now }).where(eq(markets.provider, provider));
      return;
    }

    await this._db
      .update(markets)
      .set({ isStale: true, updatedAt: now })
      .where(and(eq(markets.provider, provider), notInArray(markets.id, seenIds)));
  }

  async getIdByTicker(ticker: string): Promise<number | null> {
    const [row] = await this._db.select({ id: markets.id }).from(markets).where(eq(markets.ticker, ticker)).limit(1);

    return row?.id ?? null;
  }

  async updatePartial(
    ticker: string,
    fields: {
      title?: string;
      subtitle?: string;
      status?: string;
      yesBid?: number | null;
      yesAsk?: number | null;
      noBid?: number | null;
      noAsk?: number | null;
      lastPrice?: number | null;
      isStale?: boolean;
    },
  ): Promise<number | null> {
    const now = isoNow();
    const [updated] = await this._db
      .update(markets)
      .set({
        ...pickDefined({
          title: fields.title,
          subtitle: fields.subtitle,
          status: fields.status,
          yesBid: fields.yesBid,
          yesAsk: fields.yesAsk,
          noBid: fields.noBid,
          noAsk: fields.noAsk,
          lastPrice: fields.lastPrice,
          isStale: fields.isStale,
        }),
        updatedAt: now,
      })
      .where(eq(markets.ticker, ticker))
      .returning({ id: markets.id });

    return updated?.id ?? null;
  }
}

export class MarketSideRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async upsert(marketId: number, side: NormalizedMarketSide): Promise<void> {
    const now = isoNow();
    const values = {
      provider: side.provider,
      marketId,
      label: side.label,
      side: side.side,
      bid: side.bid,
      ask: side.ask,
      price: side.price,
      investable: side.investable,
      rawJson: JSON.stringify(side.rawJson),
      updatedAt: now,
    };

    await this._db
      .insert(marketSides)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({
        target: [marketSides.marketId, marketSides.side],
        set: values,
      });
  }
}

export class MarketFocusTagRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async replaceTags(marketId: number, tags: readonly Focus[]): Promise<void> {
    await this._db.delete(marketFocusTags).where(eq(marketFocusTags.marketId, marketId));

    if (tags.length === 0) {
      return;
    }

    await this._db.insert(marketFocusTags).values(
      tags.map((focus) => ({
        marketId,
        focus,
      })),
    );
  }
}

export interface FinishSyncRunInput {
  readonly status: SyncRunStatus;
  readonly eventsUpserted: number;
  readonly marketsUpserted: number;
  readonly errorsCount: number;
  readonly errorSummary?: string | null;
}

export class SyncRunRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async create(provider: ProviderId, focusFilterJson?: string | null): Promise<number> {
    const now = isoNow();
    const [row] = await this._db
      .insert(syncRuns)
      .values({
        provider,
        startedAt: now,
        status: 'running',
        focusFilterJson: focusFilterJson ?? null,
      })
      .returning({ id: syncRuns.id });

    if (!row) {
      throw new Error('Failed to create sync run');
    }

    return row.id;
  }

  async finish(id: number, input: FinishSyncRunInput): Promise<void> {
    await this._db
      .update(syncRuns)
      .set({
        finishedAt: isoNow(),
        status: input.status,
        eventsUpserted: input.eventsUpserted,
        marketsUpserted: input.marketsUpserted,
        errorsCount: input.errorsCount,
        errorSummary: input.errorSummary ?? null,
      })
      .where(eq(syncRuns.id, id));
  }

  async getLastSuccessfulMinUpdatedTs(provider: ProviderId): Promise<number | null> {
    const [row] = await this._db
      .select({ finishedAt: syncRuns.finishedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.provider, provider), or(eq(syncRuns.status, 'success'), eq(syncRuns.status, 'partial'))))
      .orderBy(desc(syncRuns.finishedAt))
      .limit(1);

    if (!row?.finishedAt) {
      return null;
    }

    const ms = Date.parse(row.finishedAt);
    if (!Number.isFinite(ms)) {
      return null;
    }

    return Math.floor(ms / 1000);
  }
}

export class SyncStateRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async get(key: string): Promise<string | null> {
    const [row] = await this._db.select().from(syncState).where(eq(syncState.key, key)).limit(1);
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const now = isoNow();
    await this._db
      .insert(syncState)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: syncState.key,
        set: { value, updatedAt: now },
      });
  }
}

export interface CategoryWithTags {
  readonly category: string;
  readonly tags: readonly string[];
}

export class TaxonomyRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async replaceCategoriesAndTags(provider: ProviderId, categories: readonly CategoryWithTags[]): Promise<void> {
    await this._db.delete(providerCategoryTags).where(eq(providerCategoryTags.provider, provider));
    await this._db.delete(providerCategories).where(eq(providerCategories.provider, provider));

    const now = isoNow();
    if (categories.length === 0) {
      return;
    }

    await this._db.insert(providerCategories).values(
      categories.map((entry) => ({
        provider,
        category: entry.category,
        syncedAt: now,
      })),
    );

    const tagRows = categories.flatMap((entry) =>
      entry.tags.map((tag) => ({
        provider,
        category: entry.category,
        tag,
        syncedAt: now,
      })),
    );

    if (tagRows.length > 0) {
      await this._db.insert(providerCategoryTags).values(tagRows);
    }
  }

  async upsertSeries(
    provider: ProviderId,
    rows: readonly {
      seriesTicker: string;
      category: string;
      title: string;
      tags: readonly string[];
      lastUpdatedTs: string | null;
      rawJson: unknown;
    }[],
  ): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const now = isoNow();
    await this._db
      .insert(providerSeries)
      .values(
        rows.map((row) => ({
          provider,
          seriesTicker: row.seriesTicker,
          category: row.category,
          title: row.title,
          tagsJson: JSON.stringify(row.tags),
          lastUpdatedTs: row.lastUpdatedTs,
          rawJson: JSON.stringify(row.rawJson),
          syncedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [providerSeries.provider, providerSeries.seriesTicker],
        set: {
          category: sql`excluded.category`,
          title: sql`excluded.title`,
          tagsJson: sql`excluded.tags_json`,
          lastUpdatedTs: sql`excluded.last_updated_ts`,
          rawJson: sql`excluded.raw_json`,
          syncedAt: now,
        },
      });

    return rows.length;
  }

  async loadSeriesMap(provider: ProviderId): Promise<Map<string, SeriesMetadata>> {
    const rows = await this._db.select().from(providerSeries).where(eq(providerSeries.provider, provider));
    const map = new Map<string, SeriesMetadata>();

    for (const row of rows) {
      map.set(row.seriesTicker, { category: row.category, tags: parseTagsJson(row.tagsJson) });
    }

    return map;
  }

  async listCategories(provider: ProviderId): Promise<CategoryWithTags[]> {
    const categoryRows = await this._db
      .select()
      .from(providerCategories)
      .where(eq(providerCategories.provider, provider))
      .orderBy(providerCategories.category);

    const tagRows = await this._db
      .select()
      .from(providerCategoryTags)
      .where(eq(providerCategoryTags.provider, provider));

    const tagsByCategory = new Map<string, string[]>();
    for (const row of tagRows) {
      const existing = tagsByCategory.get(row.category) ?? [];
      existing.push(row.tag);
      tagsByCategory.set(row.category, existing);
    }

    return categoryRows.map((row) => ({
      category: row.category,
      tags: tagsByCategory.get(row.category) ?? [],
    }));
  }

  async listSeries(
    provider: ProviderId,
    options?: { category?: string; limit?: number },
  ): Promise<
    readonly {
      seriesTicker: string;
      category: string;
      title: string;
      tags: readonly string[];
      lastUpdatedTs: string | null;
    }[]
  > {
    const limit = options?.limit ?? 50;
    const whereParts = [eq(providerSeries.provider, provider)];
    if (options?.category) {
      whereParts.push(eq(providerSeries.category, options.category));
    }

    const rows = await this._db
      .select()
      .from(providerSeries)
      .where(and(...whereParts))
      .orderBy(providerSeries.seriesTicker)
      .limit(limit);

    return rows.map((row) => ({
      seriesTicker: row.seriesTicker,
      category: row.category,
      title: row.title,
      tags: parseTagsJson(row.tagsJson),
      lastUpdatedTs: row.lastUpdatedTs,
    }));
  }

  async listSeriesTickersByCategory(provider: ProviderId, category: string): Promise<string[]> {
    const rows = await this._db
      .select({ seriesTicker: providerSeries.seriesTicker })
      .from(providerSeries)
      .where(and(eq(providerSeries.provider, provider), eq(providerSeries.category, category)));

    return [...new Set(rows.map((row) => row.seriesTicker))].sort();
  }

  async listFallbackCategoriesFromEvents(provider: ProviderId): Promise<CategoryWithTags[]> {
    const rows = await this._db
      .selectDistinct({ category: events.category })
      .from(events)
      .where(and(eq(events.provider, provider), isNotNull(events.category)));

    return rows
      .flatMap((row) => (row.category ? [{ category: row.category, tags: [] as string[] }] : []))
      .sort((left, right) => left.category.localeCompare(right.category));
  }

  async listAllTags(provider: ProviderId): Promise<string[]> {
    const tagRows = await this._db
      .select({ tag: providerCategoryTags.tag })
      .from(providerCategoryTags)
      .where(eq(providerCategoryTags.provider, provider));

    const tags = new Set(tagRows.map((row) => row.tag));
    return [...tags].sort((left, right) => left.localeCompare(right));
  }

  async getSyncedAt(provider: ProviderId): Promise<string | null> {
    return new SyncStateRepository(this._db).get(`${provider}:taxonomy_synced_at`);
  }
}

export type PinTargetType = 'event' | 'market';

export class PinRepository {
  constructor(private readonly _db: DatabaseClient) {}

  async pin(provider: ProviderId, targetType: PinTargetType, targetTicker: string): Promise<void> {
    const now = isoNow();
    await this._db
      .insert(pinnedItems)
      .values({
        provider,
        targetType,
        targetTicker,
        pinnedAt: now,
      })
      .onConflictDoUpdate({
        target: [pinnedItems.provider, pinnedItems.targetType, pinnedItems.targetTicker],
        set: { pinnedAt: now },
      });
  }

  async unpin(provider: ProviderId, targetType: PinTargetType, targetTicker: string): Promise<void> {
    await this._db
      .delete(pinnedItems)
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, targetType),
          eq(pinnedItems.targetTicker, targetTicker),
        ),
      );
  }

  async isPinned(provider: ProviderId, targetType: PinTargetType, targetTicker: string): Promise<boolean> {
    const [row] = await this._db
      .select({ id: pinnedItems.id })
      .from(pinnedItems)
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, targetType),
          eq(pinnedItems.targetTicker, targetTicker),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async getPinnedEventTickers(provider: ProviderId): Promise<string[]> {
    const directRows = await this._db
      .select({ eventTicker: pinnedItems.targetTicker })
      .from(pinnedItems)
      .where(and(eq(pinnedItems.provider, provider), eq(pinnedItems.targetType, 'event')));

    const marketRows = await this._db
      .select({ eventTicker: markets.eventTicker })
      .from(pinnedItems)
      .innerJoin(markets, and(eq(markets.provider, pinnedItems.provider), eq(markets.ticker, pinnedItems.targetTicker)))
      .where(and(eq(pinnedItems.provider, provider), eq(pinnedItems.targetType, 'market')));

    const tickers = new Set<string>();
    for (const row of directRows) {
      tickers.add(row.eventTicker);
    }
    for (const row of marketRows) {
      tickers.add(row.eventTicker);
    }

    return [...tickers].sort((left, right) => left.localeCompare(right));
  }

  async getPinnedAtByEventTicker(provider: ProviderId, eventTickers: readonly string[]): Promise<Map<string, string>> {
    const pinnedAtByEvent = new Map<string, string>();
    if (eventTickers.length === 0) {
      return pinnedAtByEvent;
    }

    const directRows = await this._db
      .select({ eventTicker: pinnedItems.targetTicker, pinnedAt: pinnedItems.pinnedAt })
      .from(pinnedItems)
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, 'event'),
          inArray(pinnedItems.targetTicker, [...eventTickers]),
        ),
      );

    for (const row of directRows) {
      const existing = pinnedAtByEvent.get(row.eventTicker);
      if (existing === undefined || row.pinnedAt > existing) {
        pinnedAtByEvent.set(row.eventTicker, row.pinnedAt);
      }
    }

    const marketRows = await this._db
      .select({ eventTicker: markets.eventTicker, pinnedAt: pinnedItems.pinnedAt })
      .from(pinnedItems)
      .innerJoin(markets, and(eq(markets.provider, pinnedItems.provider), eq(markets.ticker, pinnedItems.targetTicker)))
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, 'market'),
          inArray(markets.eventTicker, [...eventTickers]),
        ),
      );

    for (const row of marketRows) {
      const existing = pinnedAtByEvent.get(row.eventTicker);
      if (existing === undefined || row.pinnedAt > existing) {
        pinnedAtByEvent.set(row.eventTicker, row.pinnedAt);
      }
    }

    return pinnedAtByEvent;
  }

  async getPinnedMarketTickers(provider: ProviderId, tickers: readonly string[]): Promise<Set<string>> {
    const pinned = new Set<string>();
    if (tickers.length === 0) {
      return pinned;
    }

    const rows = await this._db
      .select({ targetTicker: pinnedItems.targetTicker })
      .from(pinnedItems)
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, 'market'),
          inArray(pinnedItems.targetTicker, [...tickers]),
        ),
      );

    for (const row of rows) {
      pinned.add(row.targetTicker);
    }

    return pinned;
  }

  async getDirectlyPinnedEventTickers(provider: ProviderId, eventTickers: readonly string[]): Promise<Set<string>> {
    const pinned = new Set<string>();
    if (eventTickers.length === 0) {
      return pinned;
    }

    const rows = await this._db
      .select({ targetTicker: pinnedItems.targetTicker })
      .from(pinnedItems)
      .where(
        and(
          eq(pinnedItems.provider, provider),
          eq(pinnedItems.targetType, 'event'),
          inArray(pinnedItems.targetTicker, [...eventTickers]),
        ),
      );

    for (const row of rows) {
      pinned.add(row.targetTicker);
    }

    return pinned;
  }
}

export function createRepositories(db: DatabaseClient) {
  return {
    events: new EventRepository(db),
    markets: new MarketRepository(db),
    marketSides: new MarketSideRepository(db),
    marketFocusTags: new MarketFocusTagRepository(db),
    syncRuns: new SyncRunRepository(db),
    syncState: new SyncStateRepository(db),
    taxonomy: new TaxonomyRepository(db),
    pins: new PinRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
