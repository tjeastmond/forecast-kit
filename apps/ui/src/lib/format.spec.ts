import { describe, expect, it } from 'vitest';
import { formatRawJsonForDisplay, marketDisplayTitle } from './format.js';

describe('marketDisplayTitle', () => {
  it('prefers subtitle when present', () => {
    expect(
      marketDisplayTitle({
        title: 'Will BTC go up?',
        subtitle: 'Mars',
      }),
    ).toBe('Mars');
  });

  it('falls back to title when subtitle is blank', () => {
    expect(
      marketDisplayTitle({
        title: 'Will BTC go up?',
        subtitle: '   ',
      }),
    ).toBe('Will BTC go up?');
  });
});

describe('formatRawJsonForDisplay', () => {
  it('pretty-prints valid JSON', () => {
    expect(formatRawJsonForDisplay('{"ticker":"KXBTC-1","status":"open"}')).toBe(
      '{\n  "ticker": "KXBTC-1",\n  "status": "open"\n}',
    );
  });

  it('returns the original string when JSON parsing fails', () => {
    expect(formatRawJsonForDisplay('not-json')).toBe('not-json');
  });
});
