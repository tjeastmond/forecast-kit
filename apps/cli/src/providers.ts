import { createProviderRegistry, loadConfig } from '@forecast-kit/core';
import { KalshiProvider } from '@forecast-kit/provider-kalshi';
import { PolymarketProvider } from '@forecast-kit/provider-polymarket';

export function createCliProviderRegistry() {
  const config = loadConfig();
  return createProviderRegistry([new KalshiProvider(config), new PolymarketProvider()]);
}
