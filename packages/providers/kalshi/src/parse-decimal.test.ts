import { describe, expect, it } from 'vitest';
import { parseDecimal, parseDecimalOrNull } from './parse-decimal.js';

describe('parseDecimal', () => {
  it('parses dollar strings', () => {
    expect(parseDecimal('0.1500')).toBe(0.15);
    expect(parseDecimal('108104.59')).toBe(108104.59);
  });

  it('returns 0 for empty values', () => {
    expect(parseDecimal('')).toBe(0);
    expect(parseDecimal(null)).toBe(0);
  });
});

describe('parseDecimalOrNull', () => {
  it('returns null for empty values', () => {
    expect(parseDecimalOrNull('')).toBeNull();
    expect(parseDecimalOrNull(undefined)).toBeNull();
  });
});
