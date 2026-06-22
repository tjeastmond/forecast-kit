export type Focus =
  | 'politics'
  | 'weather'
  | 'economics'
  | 'technology'
  | 'crypto'
  | 'entertainment'
  | 'sports';

export const FOCUS_VALUES = [
  'politics',
  'weather',
  'economics',
  'technology',
  'crypto',
  'entertainment',
  'sports',
] as const satisfies readonly Focus[];

export type ProviderId = 'kalshi' | 'polymarket';

export type MarketStatus = 'open' | 'closed' | 'settled' | 'unopened' | 'active';

export interface NormalizedEvent {
  provider: ProviderId;
  externalEventId: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  category: string | null;
  settlementSources: readonly string[];
  rawJson: unknown;
}

export interface NormalizedMarket {
  provider: ProviderId;
  externalMarketId: string;
  ticker: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  category: string | null;
  marketType: 'binary' | 'scalar';
  status: MarketStatus;
  openTime: Date;
  closeTime: Date;
  expirationTime: Date | null;
  volume: number;
  volume24h: number;
  liquidity: number;
  openInterest: number;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  lastPrice: number | null;
  rulesPrimary: string | null;
  rulesSecondary: string | null;
  rawJson: unknown;
}

/** Investable side for binary markets (YES / NO) or scalar outcomes. */
export interface NormalizedMarketSide {
  provider: ProviderId;
  label: string;
  side: 'yes' | 'no' | 'other';
  bid: number | null;
  ask: number | null;
  price: number | null;
  investable: boolean;
  rawJson: unknown;
}

export interface FetchOptions {
  readonly status?: 'open' | 'closed' | 'settled';
  readonly seriesTicker?: string;
  readonly minUpdatedTs?: number;
}

export interface ProviderEventBatch {
  events: readonly NormalizedEvent[];
  markets: readonly NormalizedMarket[];
  sides: readonly (NormalizedMarketSide & { marketTicker: string })[];
}

export interface ProviderMarket {
  market: NormalizedMarket;
  sides: readonly NormalizedMarketSide[];
}

export interface PredictionMarketProvider {
  readonly id: ProviderId;
  fetchOpenEvents(options?: FetchOptions): AsyncGenerator<ProviderEventBatch>;
  fetchMarket(ticker: string): Promise<ProviderMarket | null>;
}

export type SyncRunStatus = 'running' | 'success' | 'partial' | 'failed';
