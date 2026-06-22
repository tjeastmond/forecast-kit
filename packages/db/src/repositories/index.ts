import type {
  NormalizedEvent,
  NormalizedMarket,
  NormalizedMarketSide,
  ProviderId,
  SyncRunStatus,
} from '@forcast-kit/core';
import { eq } from 'drizzle-orm';
import { events, marketSides, markets, syncRuns } from '../schema/index.js';
import type { DatabaseClient } from '../client.js';

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

  async upsert(market: NormalizedMarket): Promise<number> {
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
      rawJson: JSON.stringify(market.rawJson),
      updatedAt: now,
      lastSeenAt: now,
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
}

export function createRepositories(db: DatabaseClient) {
  return {
    events: new EventRepository(db),
    markets: new MarketRepository(db),
    marketSides: new MarketSideRepository(db),
    syncRuns: new SyncRunRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
