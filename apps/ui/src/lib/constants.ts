export const FOCUS_VALUES = [
  'politics',
  'politicians',
  'mentions',
  'weather',
  'economics',
  'technology',
  'crypto',
  'entertainment',
  'sports',
] as const;

export type Focus = (typeof FOCUS_VALUES)[number];

export interface MarketExportV1 {
  readonly schemaVersion: '1.0';
  readonly provider: string;
  readonly ticker: string;
  readonly question: string;
  readonly focusTags: readonly string[];
  readonly isStale: boolean;
  readonly pricing: {
    readonly yesBid: number | null;
    readonly yesAsk: number | null;
    readonly noBid: number | null;
    readonly noAsk: number | null;
    readonly lastPrice: number | null;
    readonly spread: number | null;
    readonly midPrice: number | null;
    readonly impliedProbability: number | null;
  };
  readonly liquidity: {
    readonly volume: number;
    readonly openInterest: number;
  };
  readonly timing: {
    readonly openTime: string;
    readonly closeTime: string;
    readonly expirationTime: string | null;
  };
  readonly rules: {
    readonly primary: string | null;
    readonly secondary: string | null;
  };
  readonly event: {
    readonly ticker: string;
    readonly title: string;
  } | null;
}
