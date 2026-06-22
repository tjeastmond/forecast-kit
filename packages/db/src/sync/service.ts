import type { Focus, PredictionMarketProvider, SyncRunStatus } from '@forcast-kit/core';
import { deriveFocusTags, shouldPersistMarket, type FocusFilterOptions } from '@forcast-kit/core';
import { logger } from '@forcast-kit/core';
import type { Repositories } from '../repositories/index.js';

export interface SyncOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
  readonly minUpdatedTs?: number;
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

  private async executeSync(
    syncRunId: number,
    provider: PredictionMarketProvider,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    let eventsUpserted = 0;
    let marketsUpserted = 0;
    let errorsCount = 0;
    const errorMessages: string[] = [];

    const filterOptions: FocusFilterOptions = {
      ...(options?.focus !== undefined ? { focus: options.focus } : {}),
      ...(options?.exclude !== undefined ? { exclude: options.exclude } : {}),
    };

    try {
      for await (const batch of provider.fetchOpenEvents({
        status: options?.status ?? 'open',
        ...(options?.minUpdatedTs !== undefined ? { minUpdatedTs: options.minUpdatedTs } : {}),
        ...(options?.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
      })) {
        for (const event of batch.events) {
          const eventMarkets = batch.markets.filter((market) => market.eventTicker === event.eventTicker);
          const marketIdByTicker = new Map<string, number>();
          let eventPersisted = false;

          for (const market of eventMarkets) {
            const focusTags = deriveFocusTags(market);
            if (!shouldPersistMarket(market, focusTags, filterOptions)) {
              continue;
            }

            try {
              if (!eventPersisted) {
                await this.repos.events.upsert(event);
                eventsUpserted += 1;
                eventPersisted = true;
              }

              const marketId = await this.repos.markets.upsert(market);
              await this.repos.marketFocusTags.replaceTags(marketId, focusTags);
              marketIdByTicker.set(market.ticker, marketId);
              marketsUpserted += 1;
            } catch (error) {
              errorsCount += 1;
              const message = error instanceof Error ? error.message : String(error);
              errorMessages.push(`market ${market.ticker}: ${message}`);
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
              errorsCount += 1;
              const message = error instanceof Error ? error.message : String(error);
              errorMessages.push(`side ${side.marketTicker}/${side.side}: ${message}`);
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

      const status: SyncRunStatus = errorsCount > 0 ? 'partial' : 'success';
      const errorSummary = errorMessages.length > 0 ? errorMessages.slice(0, 10).join('; ') : null;

      await this.repos.syncRuns.finish(syncRunId, {
        status,
        eventsUpserted,
        marketsUpserted,
        errorsCount,
        errorSummary,
      });

      logger.info({
        component: 'sync',
        provider: provider.id,
        msg: 'sync complete',
        syncRunId,
        eventsUpserted,
        marketsUpserted,
        errorsCount,
        status,
      });

      return { syncRunId, status, eventsUpserted, marketsUpserted, errorsCount };
    } catch (error) {
      errorsCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      await this.repos.syncRuns.finish(syncRunId, {
        status: 'failed',
        eventsUpserted,
        marketsUpserted,
        errorsCount,
        errorSummary: message,
      });

      logger.error({ component: 'sync', provider: provider.id, msg: 'sync failed', syncRunId, error: message });
      throw error;
    }
  }
}

export function createSyncService(repos: Repositories): SyncService {
  return new SyncService(repos);
}
