import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    eventTicker: text('event_ticker').notNull(),
    seriesTicker: text('series_ticker').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    category: text('category'),
    settlementSourcesJson: text('settlement_sources_json').notNull().default('[]'),
    rawJson: text('raw_json').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    lastSeenAt: text('last_seen_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('events_provider_event_ticker_unique').on(table.provider, table.eventTicker),
    index('events_category_idx').on(table.category),
  ],
);

export const markets = sqliteTable(
  'markets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    externalMarketId: text('external_market_id').notNull(),
    ticker: text('ticker').notNull(),
    eventTicker: text('event_ticker').notNull(),
    seriesTicker: text('series_ticker').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    category: text('category'),
    marketType: text('market_type').notNull(),
    status: text('status').notNull(),
    closeTime: text('close_time').notNull(),
    expirationTime: text('expiration_time'),
    openTime: text('open_time').notNull(),
    volume: real('volume').notNull().default(0),
    volume24h: real('volume_24h').notNull().default(0),
    liquidity: real('liquidity').notNull().default(0),
    openInterest: real('open_interest').notNull().default(0),
    yesBid: real('yes_bid'),
    yesAsk: real('yes_ask'),
    noBid: real('no_bid'),
    noAsk: real('no_ask'),
    lastPrice: real('last_price'),
    rulesPrimary: text('rules_primary'),
    rulesSecondary: text('rules_secondary'),
    seriesTagsJson: text('series_tags_json').notNull().default('[]'),
    rawJson: text('raw_json').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    lastSeenAt: text('last_seen_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    isStale: integer('is_stale', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    uniqueIndex('markets_provider_ticker_unique').on(table.provider, table.ticker),
    index('markets_status_close_time_idx').on(table.status, table.closeTime),
    index('markets_event_ticker_idx').on(table.eventTicker),
  ],
);

export const marketSides = sqliteTable(
  'market_sides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    marketId: integer('market_id')
      .notNull()
      .references(() => markets.id),
    label: text('label').notNull(),
    side: text('side').notNull(),
    bid: real('bid'),
    ask: real('ask'),
    price: real('price'),
    investable: integer('investable', { mode: 'boolean' }).notNull().default(false),
    rawJson: text('raw_json'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('market_sides_market_id_side_unique').on(table.marketId, table.side)],
);

export const marketFocusTags = sqliteTable(
  'market_focus_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    marketId: integer('market_id')
      .notNull()
      .references(() => markets.id),
    focus: text('focus').notNull(),
  },
  (table) => [
    uniqueIndex('market_focus_tags_market_id_focus_unique').on(table.marketId, table.focus),
    index('market_focus_tags_focus_idx').on(table.focus),
  ],
);

export const syncRuns = sqliteTable('sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status').notNull(),
  eventsUpserted: integer('events_upserted').notNull().default(0),
  marketsUpserted: integer('markets_upserted').notNull().default(0),
  errorsCount: integer('errors_count').notNull().default(0),
  focusFilterJson: text('focus_filter_json'),
  errorSummary: text('error_summary'),
});

export const providerCategories = sqliteTable(
  'provider_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    category: text('category').notNull(),
    syncedAt: text('synced_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('provider_categories_provider_category_unique').on(table.provider, table.category)],
);

export const providerCategoryTags = sqliteTable(
  'provider_category_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    category: text('category').notNull(),
    tag: text('tag').notNull(),
    syncedAt: text('synced_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('provider_category_tags_provider_category_tag_unique').on(table.provider, table.category, table.tag),
    index('provider_category_tags_tag_idx').on(table.tag),
  ],
);

export const providerSeries = sqliteTable(
  'provider_series',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    seriesTicker: text('series_ticker').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    tagsJson: text('tags_json').notNull().default('[]'),
    lastUpdatedTs: text('last_updated_ts'),
    rawJson: text('raw_json').notNull(),
    syncedAt: text('synced_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('provider_series_provider_series_ticker_unique').on(table.provider, table.seriesTicker),
    index('provider_series_category_idx').on(table.category),
  ],
);

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const pinnedItems = sqliteTable(
  'pinned_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    targetType: text('target_type').notNull(),
    targetTicker: text('target_ticker').notNull(),
    pinnedAt: text('pinned_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('pinned_items_provider_target_unique').on(table.provider, table.targetType, table.targetTicker),
    index('pinned_items_pinned_at_idx').on(table.pinnedAt),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type MarketRow = typeof markets.$inferSelect;
export type MarketSideRow = typeof marketSides.$inferSelect;
export type MarketFocusTagRow = typeof marketFocusTags.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;
export type ProviderCategoryRow = typeof providerCategories.$inferSelect;
export type ProviderCategoryTagRow = typeof providerCategoryTags.$inferSelect;
export type ProviderSeriesRow = typeof providerSeries.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;
export type PinnedItemRow = typeof pinnedItems.$inferSelect;
