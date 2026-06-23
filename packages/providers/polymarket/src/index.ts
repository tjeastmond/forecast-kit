/* eslint-disable require-yield -- Phase 5 stub */
import type { PredictionMarketProvider, ProviderEventBatch } from '@forcast-kit/core';

/** Polymarket provider stub — Phase 5. */
export class PolymarketProvider implements PredictionMarketProvider {
  readonly id = 'polymarket' as const;

  fetchOpenEvents(): AsyncGenerator<ProviderEventBatch> {
    return (async function* (): AsyncGenerator<ProviderEventBatch> {
      await Promise.resolve();
      throw new Error('PolymarketProvider not implemented');
    })();
  }

  fetchEvent(eventTicker: string): Promise<ProviderEventBatch | null> {
    void eventTicker;
    return Promise.reject(new Error('PolymarketProvider not implemented'));
  }

  fetchMarket(ticker: string): Promise<null> {
    void ticker;
    return Promise.reject(new Error('PolymarketProvider not implemented'));
  }
}
