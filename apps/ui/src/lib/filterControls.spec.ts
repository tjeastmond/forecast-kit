import { describe, expect, it } from 'vitest';
import { FOCUS_VALUES } from '@/lib/constants';
import {
  FILTER_DROPDOWN_PANEL_CLASS,
  buildFilterItems,
  formatFilterOptionLabel,
  toggleSetSelection,
} from './filterControls.js';

describe('formatFilterOptionLabel', () => {
  it('title-cases a lowercase option', () => {
    expect(formatFilterOptionLabel('politics')).toBe('Politics');
    expect(formatFilterOptionLabel('open')).toBe('Open');
  });

  it('returns empty strings unchanged', () => {
    expect(formatFilterOptionLabel('')).toBe('');
  });
});

describe('buildFilterItems', () => {
  it('builds title-cased labels while preserving values', () => {
    expect(buildFilterItems(['open', 'closed'] as const)).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
  });

  it('sorts focus values alphabetically when requested', () => {
    const items = buildFilterItems(FOCUS_VALUES, { sort: true });

    expect(items.map((item) => item.value)).toEqual([...FOCUS_VALUES].sort((a, b) => a.localeCompare(b)));
    expect(items[0]).toEqual({ value: 'crypto', label: 'Crypto' });
    expect(items.at(-1)).toEqual({ value: 'weather', label: 'Weather' });
  });
});

describe('toggleSetSelection', () => {
  it('adds and removes values immutably', () => {
    const initial = new Set(['open'] as const);
    const added = toggleSetSelection(initial, 'closed', true);
    const removed = toggleSetSelection(added, 'open', false);

    expect(initial).toEqual(new Set(['open']));
    expect(added).toEqual(new Set(['open', 'closed']));
    expect(removed).toEqual(new Set(['closed']));
  });
});

describe('FILTER_DROPDOWN_PANEL_CLASS', () => {
  it('limits dropdown height and enables scrolling', () => {
    expect(FILTER_DROPDOWN_PANEL_CLASS).toContain('max-h-64');
    expect(FILTER_DROPDOWN_PANEL_CLASS).toContain('overflow-y-auto');
  });
});
