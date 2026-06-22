/* eslint-disable require-yield -- Phase 2 stub */
import type { PredictionMarketProvider, ProviderEventBatch } from '@forcast-kit/core';

/** Kalshi provider — implemented in Phase 2. */
export class KalshiProvider implements PredictionMarketProvider {
  readonly id = 'kalshi' as const;

  fetchOpenEvents(): AsyncGenerator<ProviderEventBatch> {
    return (async function* (): AsyncGenerator<ProviderEventBatch> {
      await Promise.resolve();
      throw new Error('KalshiProvider.fetchOpenEvents not implemented');
    })();
  }

  fetchMarket(ticker: string): Promise<null> {
    void ticker;
    return Promise.reject(new Error('KalshiProvider.fetchMarket not implemented'));
  }
}
