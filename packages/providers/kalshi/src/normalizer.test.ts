import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { kalshiEventsResponseSchema } from './schemas.js';
import { normalizeEventWithMarkets } from './normalizer.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/events-page.json');

describe('normalizeEventWithMarkets', () => {
  it('maps Kalshi fixture to normalized domain models', () => {
    const raw: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const response = kalshiEventsResponseSchema.parse(raw);
    const event = response.events[0];
    expect(event).toBeDefined();
    if (!event) {
      return;
    }

    const batch = normalizeEventWithMarkets(event);

    expect(batch.events).toHaveLength(1);
    expect(batch.markets.length).toBeGreaterThanOrEqual(1);
    expect(batch.sides.length).toBeGreaterThanOrEqual(2);

    const normalizedEvent = batch.events[0];
    expect(normalizedEvent).toBeDefined();
    if (!normalizedEvent) {
      return;
    }
    expect(normalizedEvent.provider).toBe('kalshi');
    expect(normalizedEvent.eventTicker).toBeTruthy();
    expect(normalizedEvent.settlementSources.length).toBeGreaterThan(0);

    const market = batch.markets[0];
    expect(market).toBeDefined();
    if (!market) {
      return;
    }
    expect(market.ticker).toBeTruthy();
    expect(market.yesBid).toBeGreaterThan(0);
    expect(market.status).toBe('active');

    const yesSide = batch.sides.find((side) => side.side === 'yes');
    const noSide = batch.sides.find((side) => side.side === 'no');
    expect(yesSide?.investable).toBe(true);
    expect(noSide?.side).toBe('no');
  });
});
