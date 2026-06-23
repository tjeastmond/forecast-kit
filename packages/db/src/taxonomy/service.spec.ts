import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRepositories } from '../repositories/index.js';
import { createTestDatabase } from '../test-utils.js';
import { createTaxonomySyncService, type TaxonomyFetcher } from './service.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../../../providers/kalshi/fixtures');

function createMockFetcher(): TaxonomyFetcher {
  const tagsPayload = JSON.parse(readFileSync(join(fixtureDir, 'tags-by-categories.json'), 'utf8')) as {
    tags_by_categories: Record<string, string[] | null>;
  };
  const seriesPayload = JSON.parse(readFileSync(join(fixtureDir, 'series-list.json'), 'utf8')) as {
    series: Array<{
      ticker: string;
      category: string;
      title: string;
      tags: string[] | null;
      last_updated_ts?: string;
    }>;
  };

  return {
    fetchTagsByCategories: () => Promise.resolve(tagsPayload),
    fetchAllSeries: () => Promise.resolve(seriesPayload.series),
  };
}

describe('TaxonomySyncService', () => {
  it('syncs categories, tags, and series into the database', async () => {
    const db = createTestDatabase();
    const repos = createRepositories(db);
    const service = createTaxonomySyncService(repos, createMockFetcher());

    const result = await service.syncKalshiTaxonomy({ full: true });

    expect(result.categoriesUpserted).toBeGreaterThan(0);
    expect(result.seriesUpserted).toBe(2);

    const categories = await repos.taxonomy.listCategories('kalshi');
    expect(categories.some((entry) => entry.category === 'Politics')).toBe(true);

    const seriesMap = await service.loadSeriesMetadataMap();
    expect(seriesMap.get('KXPRES')?.category).toBe('Politics');
    expect(seriesMap.get('KXHIGHNY')?.tags).toContain('Temperature');
  });
});
