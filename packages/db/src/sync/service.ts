import type { Focus, PredictionMarketProvider, ProviderEventBatch, SyncRunStatus } from '@forcast-kit/core';
import { deriveFocusTags, logger, shouldPersistMarket, type FocusFilterOptions } from '@forcast-kit/core';
import type { Repositories } from '../repositories/index.js';

export interface SyncOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly minUpdatedTs?: number;
  readonly full?: boolean;
  readonly status?: 'open' | 'closed' | 'settled';
  readonly maxPages?: number;
}

export interface SyncResult {
  readonly syncRunId: number;
  readonly status: SyncRunStatus;
  readonly eventsUpserted: number;
  readonly marketsUpserted: number;
  readonly errorsCount: number;
}

interface BatchUpsertState {
  eventsUpserted: number;
  marketsUpserted: number;
  errorsCount: number;
  errorMessages: string[];
  seenMarketIds: Set<number>;
}

export class SyncService {
  constructor(private readonly repos: Repositories) {}

  async syncProvider(provider: PredictionMarketProvider, options?: SyncOptions): Promise<SyncResult> {
    const focusFilterJson =
      options?.focus !== undefined || options?.exclude !== undefined
        ? JSON.stringify({ focus: options.focus ?? [], exclude: options.exclude ?? [] })
        : null;

    const syncRunId = await this.repos.syncRuns.create(provider.id, focusFilterJson);
    return this.executeSync(syncRunId, provider, options);
  }

  async syncEvent(provider: PredictionMarketProvider, eventTicker: string): Promise<SyncResult> {
    const syncRunId = await this.repos.syncRuns.create(provider.id, JSON.stringify({ eventTicker }));
    return this.executeEventSync(syncRunId, provider, eventTicker);
  }

  async startBackgroundSync(provider: PredictionMarketProvider, options?: SyncOptions): Promise<{ syncRunId: number }> {
    const focusFilterJson =
      options?.focus !== undefined || options?.exclude !== undefined
        ? JSON.stringify({ focus: options.focus ?? [], exclude: options.exclude ?? [] })
        : null;

    const syncRunId = await this.repos.syncRuns.create(provider.id, focusFilterJson);

    void this.executeSync(syncRunId, provider, options).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        component: 'sync',
        provider: provider.id,
        msg: 'background sync failed',
        syncRunId,
        error: message,
      });
    });

    return { syncRunId };
  }

  async startBackgroundEventSync(
    provider: PredictionMarketProvider,
    eventTicker: string,
  ): Promise<{ syncRunId: number }> {
    const syncRunId = await this.repos.syncRuns.create(provider.id, JSON.stringify({ eventTicker }));

    void this.executeEventSync(syncRunId, provider, eventTicker).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        component: 'sync',
        provider: provider.id,
        msg: 'background event sync failed',
        syncRunId,
        eventTicker,
        error: message,
      });
    });

    return { syncRunId };
  }

  private async executeEventSync(
    syncRunId: number,
    provider: PredictionMarketProvider,
    eventTicker: string,
  ): Promise<SyncResult> {
    const state: BatchUpsertState = {
      eventsUpserted: 0,
      marketsUpserted: 0,
      errorsCount: 0,
      errorMessages: [],
      seenMarketIds: new Set<number>(),
    };

    try {
      const batch = await provider.fetchEvent(eventTicker);
      if (!batch) {
        const message = `Event not found: ${eventTicker}`;
        await this.repos.syncRuns.finish(syncRunId, {
          status: 'failed',
          eventsUpserted: 0,
          marketsUpserted: 0,
          errorsCount: 1,
          errorSummary: message,
        });
        return { syncRunId, status: 'failed', eventsUpserted: 0, marketsUpserted: 0, errorsCount: 1 };
      }

      await this.upsertBatch(batch, {}, { skipFocusFilter: true }, state);

      const status: SyncRunStatus = state.errorsCount > 0 ? 'partial' : 'success';
      const errorSummary = state.errorMessages.length > 0 ? state.errorMessages.slice(0, 10).join('; ') : null;

      await this.repos.syncRuns.finish(syncRunId, {
        status,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        errorSummary,
      });

      logger.info({
        component: 'sync',
        provider: provider.id,
        msg: 'event sync complete',
        syncRunId,
        eventTicker,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        status,
      });

      return {
        syncRunId,
        status,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
      };
    } catch (error) {
      state.errorsCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      await this.repos.syncRuns.finish(syncRunId, {
        status: 'failed',
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        errorSummary: message,
      });

      logger.error({
        component: 'sync',
        provider: provider.id,
        msg: 'event sync failed',
        syncRunId,
        eventTicker,
        error: message,
      });
      throw error;
    }
  }

  private async executeSync(
    syncRunId: number,
    provider: PredictionMarketProvider,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const state: BatchUpsertState = {
      eventsUpserted: 0,
      marketsUpserted: 0,
      errorsCount: 0,
      errorMessages: [],
      seenMarketIds: new Set<number>(),
    };

    let resolvedMinUpdatedTs = options?.minUpdatedTs;
    if (options?.full !== true && resolvedMinUpdatedTs === undefined) {
      const lastTs = await this.repos.syncRuns.getLastSuccessfulMinUpdatedTs(provider.id);
      if (lastTs !== null) {
        resolvedMinUpdatedTs = lastTs;
      }
    }

    const resolvedOptions: SyncOptions = {
      ...(options?.focus !== undefined ? { focus: options.focus } : {}),
      ...(options?.exclude !== undefined ? { exclude: options.exclude } : {}),
      ...(options?.status !== undefined ? { status: options.status } : {}),
      ...(options?.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
      ...(options?.full === true ? { full: true } : {}),
      ...(resolvedMinUpdatedTs !== undefined ? { minUpdatedTs: resolvedMinUpdatedTs } : {}),
    };

    const filterOptions: FocusFilterOptions = {
      ...(resolvedOptions.focus !== undefined ? { focus: resolvedOptions.focus } : {}),
      ...(resolvedOptions.exclude !== undefined ? { exclude: resolvedOptions.exclude } : {}),
    };

    try {
      for await (const batch of provider.fetchOpenEvents({
        status: resolvedOptions.status ?? 'open',
        ...(resolvedOptions.minUpdatedTs !== undefined ? { minUpdatedTs: resolvedOptions.minUpdatedTs } : {}),
        ...(resolvedOptions.maxPages !== undefined ? { maxPages: resolvedOptions.maxPages } : {}),
      })) {
        await this.upsertBatch(batch, filterOptions, { skipFocusFilter: false }, state);
      }

      const status: SyncRunStatus = state.errorsCount > 0 ? 'partial' : 'success';
      const errorSummary = state.errorMessages.length > 0 ? state.errorMessages.slice(0, 10).join('; ') : null;

      const isFullSync = resolvedOptions.full === true || resolvedOptions.minUpdatedTs === undefined;
      if (isFullSync) {
        await this.repos.markets.markStaleExcept(provider.id, state.seenMarketIds);
      }

      await this.repos.syncRuns.finish(syncRunId, {
        status,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        errorSummary,
      });

      logger.info({
        component: 'sync',
        provider: provider.id,
        msg: 'sync complete',
        syncRunId,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        status,
      });

      return {
        syncRunId,
        status,
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
      };
    } catch (error) {
      state.errorsCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      await this.repos.syncRuns.finish(syncRunId, {
        status: 'failed',
        eventsUpserted: state.eventsUpserted,
        marketsUpserted: state.marketsUpserted,
        errorsCount: state.errorsCount,
        errorSummary: message,
      });

      logger.error({ component: 'sync', provider: provider.id, msg: 'sync failed', syncRunId, error: message });
      throw error;
    }
  }

  private async upsertBatch(
    batch: ProviderEventBatch,
    filterOptions: FocusFilterOptions,
    options: { skipFocusFilter: boolean },
    state: BatchUpsertState,
  ): Promise<void> {
    for (const event of batch.events) {
      const eventMarkets = batch.markets.filter((market) => market.eventTicker === event.eventTicker);
      const marketIdByTicker = new Map<string, number>();
      let eventPersisted = false;

      for (const market of eventMarkets) {
        const focusTags = deriveFocusTags(market);
        if (!options.skipFocusFilter && !shouldPersistMarket(market, focusTags, filterOptions)) {
          continue;
        }

        try {
          if (!eventPersisted) {
            await this.repos.events.upsert(event);
            state.eventsUpserted += 1;
            eventPersisted = true;
          }

          const marketId = await this.repos.markets.upsert(market);
          await this.repos.marketFocusTags.replaceTags(marketId, focusTags);
          marketIdByTicker.set(market.ticker, marketId);
          state.seenMarketIds.add(marketId);
          state.marketsUpserted += 1;
        } catch (error) {
          state.errorsCount += 1;
          const message = error instanceof Error ? error.message : String(error);
          state.errorMessages.push(`market ${market.ticker}: ${message}`);
          logger.warn({ component: 'sync', msg: 'market upsert failed', ticker: market.ticker, error: message });
        }
      }

      for (const side of batch.sides) {
        const marketId = marketIdByTicker.get(side.marketTicker);
        if (marketId === undefined) {
          continue;
        }

        try {
          await this.repos.marketSides.upsert(marketId, side);
        } catch (error) {
          state.errorsCount += 1;
          const message = error instanceof Error ? error.message : String(error);
          state.errorMessages.push(`side ${side.marketTicker}/${side.side}: ${message}`);
          logger.warn({
            component: 'sync',
            msg: 'side upsert failed',
            ticker: side.marketTicker,
            side: side.side,
            error: message,
          });
        }
      }
    }
  }
}

export function createSyncService(repos: Repositories): SyncService {
  return new SyncService(repos);
}
