import { z } from 'zod';

const settlementSourceSchema = z
  .object({
    name: z.string(),
    url: z.string().optional(),
  })
  .passthrough();

export const kalshiMarketSchema = z
  .object({
    ticker: z.string(),
    event_ticker: z.string(),
    title: z.string(),
    status: z.string(),
    market_type: z.string(),
    close_time: z.string(),
    open_time: z.string(),
    expiration_time: z.string().optional(),
    yes_bid_dollars: z.string().optional(),
    yes_ask_dollars: z.string().optional(),
    no_bid_dollars: z.string().optional(),
    no_ask_dollars: z.string().optional(),
    last_price_dollars: z.string().optional(),
    volume_fp: z.string().optional(),
    volume_24h_fp: z.string().optional(),
    open_interest_fp: z.string().optional(),
    liquidity_dollars: z.string().optional(),
    rules_primary: z.string().optional(),
    rules_secondary: z.string().optional(),
    yes_sub_title: z.string().optional(),
    no_sub_title: z.string().optional(),
  })
  .passthrough();

export const kalshiEventSchema = z
  .object({
    event_ticker: z.string(),
    series_ticker: z.string(),
    title: z.string(),
    sub_title: z.string().optional(),
    category: z.string().optional(),
    settlement_sources: z.array(settlementSourceSchema).optional(),
    markets: z.array(kalshiMarketSchema).optional(),
  })
  .passthrough();

export const kalshiEventsResponseSchema = z
  .object({
    cursor: z.string().nullable().optional(),
    events: z.array(kalshiEventSchema),
  })
  .passthrough();

export const kalshiMarketResponseSchema = z
  .object({
    market: kalshiMarketSchema,
  })
  .passthrough();

export const kalshiEventResponseSchema = z
  .object({
    event: kalshiEventSchema,
    markets: z.array(kalshiMarketSchema).optional(),
  })
  .passthrough();

export type KalshiMarket = z.infer<typeof kalshiMarketSchema>;
export type KalshiEvent = z.infer<typeof kalshiEventSchema>;
export type KalshiEventsResponse = z.infer<typeof kalshiEventsResponseSchema>;
export type KalshiEventResponse = z.infer<typeof kalshiEventResponseSchema>;
