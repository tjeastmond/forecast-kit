import type { ProviderId, SeriesMetadata } from '@forecast-kit/core';
import { logger } from '@forecast-kit/core';
import type { Repositories } from '../repositories/index.js';

const TAXONOMY_SYNCED_AT_KEY = (provider: ProviderId): string => `${provider}:taxonomy_synced_at`;
const SERIES_MIN_UPDATED_TS_KEY = (provider: ProviderId): string => `${provider}:series_min_updated_ts`;

export interface TaxonomySeriesRow {
  readonly ticker: string;
  readonly category: string;
  readonly title: string;
  readonly tags: readonly string[] | null;
  readonly last_updated_ts?: string;
}

export interface TaxonomyFetcher {
  fetchTagsByCategories(): Promise<{ tags_by_categories: Record<string, string[] | null> }>;
  fetchAllSeries(options?: {
    readonly categories?: readonly string[];
    readonly minUpdatedTs?: number;
  }): Promise<readonly TaxonomySeriesRow[]>;
}

export interface TaxonomySyncOptions {
  readonly full?: boolean;
}

export interface TaxonomySyncResult {
  readonly categoriesUpserted: number;
  readonly tagsUpserted: number;
  readonly seriesUpserted: number;
  readonly syncedAt: string;
}

export class TaxonomySyncService {
  constructor(
    private readonly repos: Repositories,
    private readonly fetcher: TaxonomyFetcher,
  ) {}

  async syncKalshiTaxonomy(options?: TaxonomySyncOptions): Promise<TaxonomySyncResult> {
    const provider: ProviderId = 'kalshi';
    const syncedAt = new Date().toISOString();

    const tagsResponse = await this.fetcher.fetchTagsByCategories();
    const categories = Object.entries(tagsResponse.tags_by_categories).map(([category, tags]) => ({
      category,
      tags: tags ?? [],
    }));

    await this.repos.taxonomy.replaceCategoriesAndTags(provider, categories);

    let minUpdatedTs: number | undefined;
    if (options?.full !== true) {
      const stored = await this.repos.syncState.get(SERIES_MIN_UPDATED_TS_KEY(provider));
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (Number.isFinite(parsed)) {
          minUpdatedTs = parsed;
        }
      }
    }

    const categoryNames = categories.map((entry) => entry.category);
    const seriesRows = await this.fetcher.fetchAllSeries(
      minUpdatedTs === undefined ? { categories: categoryNames } : { minUpdatedTs },
    );

    const seriesUpserted = await this.repos.taxonomy.upsertSeries(
      provider,
      seriesRows.map((row) => ({
        seriesTicker: row.ticker,
        category: row.category,
        title: row.title,
        tags: row.tags ?? [],
        lastUpdatedTs: row.last_updated_ts ?? null,
        rawJson: row,
      })),
    );

    await this.repos.syncState.set(TAXONOMY_SYNCED_AT_KEY(provider), syncedAt);

    const latestSeriesTs = seriesRows
      .map((row) => row.last_updated_ts)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => Math.floor(Date.parse(value) / 1000))
      .filter((value) => Number.isFinite(value));

    if (latestSeriesTs.length > 0) {
      const maxTs = Math.max(...latestSeriesTs);
      await this.repos.syncState.set(SERIES_MIN_UPDATED_TS_KEY(provider), String(maxTs));
    }

    const tagsUpserted = categories.reduce((sum, entry) => sum + entry.tags.length, 0);

    logger.info({
      component: 'taxonomy-sync',
      provider,
      msg: 'taxonomy sync complete',
      categoriesUpserted: categories.length,
      tagsUpserted,
      seriesUpserted,
    });

    return {
      categoriesUpserted: categories.length,
      tagsUpserted,
      seriesUpserted,
      syncedAt,
    };
  }

  async loadSeriesMetadataMap(provider: ProviderId = 'kalshi'): Promise<Map<string, SeriesMetadata>> {
    const raw = await this.repos.taxonomy.loadSeriesMap(provider);
    const map = new Map<string, SeriesMetadata>();

    for (const [seriesTicker, metadata] of raw) {
      map.set(seriesTicker, {
        category: metadata.category,
        tags: metadata.tags,
      });
    }

    return map;
  }

  async getTaxonomySyncedAt(provider: ProviderId = 'kalshi'): Promise<string | null> {
    return this.repos.syncState.get(TAXONOMY_SYNCED_AT_KEY(provider));
  }
}

export function createTaxonomySyncService(repos: Repositories, fetcher: TaxonomyFetcher): TaxonomySyncService {
  return new TaxonomySyncService(repos, fetcher);
}
