import type {
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  ProviderId,
  SyncRunStatus,
} from '@forecast-kit/core';
import type { Focus } from '@forecast-kit/core';
import { and, eq, isNotNull, notInArray, or, desc } from 'drizzle-orm';
import {
  events,
  marketFocusTags,
  marketSides,
  markets,
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
    const [existing] = await this._db
      .select({ id: markets.id })
      .from(markets)
      .where(eq(markets.ticker, ticker))
      .limit(1);
    if (!existing) {
      return null;
    }

    const now = isoNow();
    await this._db
      .update(markets)
      .set({
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.subtitle !== undefined ? { subtitle: fields.subtitle } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.yesBid !== undefined ? { yesBid: fields.yesBid } : {}),
        ...(fields.yesAsk !== undefined ? { yesAsk: fields.yesAsk } : {}),
        ...(fields.noBid !== undefined ? { noBid: fields.noBid } : {}),
        ...(fields.noAsk !== undefined ? { noAsk: fields.noAsk } : {}),
        ...(fields.lastPrice !== undefined ? { lastPrice: fields.lastPrice } : {}),
        ...(fields.isStale !== undefined ? { isStale: fields.isStale } : {}),
        updatedAt: now,
      })
      .where(eq(markets.id, existing.id));

    return existing.id;
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
    const now = isoNow();
    let count = 0;

    for (const row of rows) {
      await this._db
        .insert(providerSeries)
        .values({
          provider,
          seriesTicker: row.seriesTicker,
          category: row.category,
          title: row.title,
          tagsJson: JSON.stringify(row.tags),
          lastUpdatedTs: row.lastUpdatedTs,
          rawJson: JSON.stringify(row.rawJson),
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: [providerSeries.provider, providerSeries.seriesTicker],
          set: {
            category: row.category,
            title: row.title,
            tagsJson: JSON.stringify(row.tags),
            lastUpdatedTs: row.lastUpdatedTs,
            rawJson: JSON.stringify(row.rawJson),
            syncedAt: now,
          },
        });
      count += 1;
    }

    return count;
  }

  async loadSeriesMap(provider: ProviderId): Promise<Map<string, { category: string; tags: string[] }>> {
    const rows = await this._db.select().from(providerSeries).where(eq(providerSeries.provider, provider));
    const map = new Map<string, { category: string; tags: string[] }>();

    for (const row of rows) {
      let tags: string[] = [];
      try {
        const parsed: unknown = JSON.parse(row.tagsJson);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((value): value is string => typeof value === 'string');
        }
      } catch {
        tags = [];
      }
      map.set(row.seriesTicker, { category: row.category, tags });
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

    return rows.map((row) => {
      let tags: string[] = [];
      try {
        const parsed: unknown = JSON.parse(row.tagsJson);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((value): value is string => typeof value === 'string');
        }
      } catch {
        tags = [];
      }

      return {
        seriesTicker: row.seriesTicker,
        category: row.category,
        title: row.title,
        tags,
        lastUpdatedTs: row.lastUpdatedTs,
      };
    });
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

export function createRepositories(db: DatabaseClient) {
  return {
    events: new EventRepository(db),
    markets: new MarketRepository(db),
    marketSides: new MarketSideRepository(db),
    marketFocusTags: new MarketFocusTagRepository(db),
    syncRuns: new SyncRunRepository(db),
    syncState: new SyncStateRepository(db),
    taxonomy: new TaxonomyRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
