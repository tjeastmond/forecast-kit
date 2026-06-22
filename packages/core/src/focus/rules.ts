import type { Focus, NormalizedMarket } from '../types/index.js';
import rulesJson from './rules.json' with { type: 'json' };

export interface FocusRule {
  readonly categories: readonly string[];
  readonly seriesPrefixes: readonly string[];
  readonly keywords: readonly string[];
}

export type FocusRules = Record<Focus, FocusRule>;

const RULES = rulesJson as FocusRules;

function textIncludesKeyword(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

function matchesCategory(category: string | null, ruleCategories: readonly string[]): boolean {
  if (!category) {
    return false;
  }
  return ruleCategories.some((ruleCategory) => textIncludesKeyword(category, ruleCategory));
}

function matchesSeriesPrefix(seriesTicker: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => seriesTicker.startsWith(prefix));
}

function matchesKeywords(market: NormalizedMarket, keywords: readonly string[]): boolean {
  const searchText = [market.title, market.subtitle, market.ticker, market.eventTicker].join(' ');
  return keywords.some((keyword) => textIncludesKeyword(searchText, keyword));
}

export function deriveFocusTags(market: NormalizedMarket): Focus[] {
  const tags: Focus[] = [];

  for (const focus of Object.keys(RULES) as Focus[]) {
    const rule = RULES[focus];
    const categoryMatch = matchesCategory(market.category, rule.categories);
    const seriesMatch = matchesSeriesPrefix(market.seriesTicker, rule.seriesPrefixes);
    const keywordMatch = matchesKeywords(market, rule.keywords);

    if (focus === 'sports' && market.category?.toLowerCase().includes('sport')) {
      tags.push('sports');
      continue;
    }

    if (categoryMatch || seriesMatch || keywordMatch) {
      tags.push(focus);
    }
  }

  return tags;
}

export interface FocusFilterOptions {
  readonly focus?: readonly Focus[];
  readonly exclude?: readonly Focus[];
}

export function matchesFocusFilter(tags: readonly Focus[], options: FocusFilterOptions): boolean {
  const focus = options.focus ?? [];
  const exclude = options.exclude ?? [];

  if (focus.length > 0 && !focus.some((value) => tags.includes(value))) {
    return false;
  }

  if (exclude.length > 0 && exclude.some((value) => tags.includes(value))) {
    return false;
  }

  return true;
}

export function shouldPersistMarket(
  market: NormalizedMarket,
  tags: readonly Focus[],
  options: FocusFilterOptions,
): boolean {
  const hasFilter = (options.focus?.length ?? 0) > 0 || (options.exclude?.length ?? 0) > 0;
  if (!hasFilter) {
    return true;
  }
  return matchesFocusFilter(tags, options);
}
