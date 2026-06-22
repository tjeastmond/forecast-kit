import { describe, expect, it } from 'vitest';
import type { NormalizedMarket } from '../types/index.js';
import { deriveFocusTags, matchesFocusFilter } from './rules.js';

const politicsMarket: NormalizedMarket = {
  provider: 'kalshi',
  externalMarketId: 'KXPRES-24',
  ticker: 'KXPRES-24-DEM',
  eventTicker: 'KXPRES-24',
  seriesTicker: 'KXPRES',
  title: 'Will a Democrat win the 2024 presidential election?',
  subtitle: '',
  category: 'Politics',
  marketType: 'binary',
  status: 'open',
  openTime: new Date(),
  closeTime: new Date(),
  expirationTime: null,
  volume: 0,
  volume24h: 0,
  liquidity: 0,
  openInterest: 0,
  yesBid: null,
  yesAsk: null,
  noBid: null,
  noAsk: null,
  lastPrice: null,
  rulesPrimary: null,
  rulesSecondary: null,
  rawJson: {},
};

describe('deriveFocusTags', () => {
  it('tags politics markets by category and series prefix', () => {
    const tags = deriveFocusTags(politicsMarket);
    expect(tags).toContain('politics');
  });

  it('tags weather markets by series prefix', () => {
    const market: NormalizedMarket = {
      ...politicsMarket,
      category: 'Climate and Weather',
      seriesTicker: 'KXHIGHNY',
      ticker: 'KXHIGHNY-25JUN22-T75',
      title: 'High temp in NYC on Jun 22, 2025?',
    };
    const tags = deriveFocusTags(market);
    expect(tags).toContain('weather');
  });
});

describe('matchesFocusFilter', () => {
  it('includes markets matching any focus tag', () => {
    expect(matchesFocusFilter(['politics', 'economics'], { focus: ['politics'] })).toBe(true);
    expect(matchesFocusFilter(['economics'], { focus: ['politics'] })).toBe(false);
  });

  it('excludes markets matching exclude tags', () => {
    expect(matchesFocusFilter(['politics'], { exclude: ['sports'] })).toBe(true);
    expect(matchesFocusFilter(['politics', 'sports'], { exclude: ['sports'] })).toBe(false);
  });

  it('applies include then exclude when both provided', () => {
    expect(
      matchesFocusFilter(['politics', 'weather'], {
        focus: ['politics', 'weather'],
        exclude: ['sports'],
      }),
    ).toBe(true);
    expect(
      matchesFocusFilter(['politics', 'sports'], {
        focus: ['politics'],
        exclude: ['sports'],
      }),
    ).toBe(false);
  });
});
