import { FOCUS_VALUES, type Focus } from '../types/index.js';

export { FOCUS_VALUES, type Focus };

export function parseFocusList(value: string | undefined): Focus[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is Focus => FOCUS_VALUES.includes(part as Focus));
}

export function isFocus(value: string): value is Focus {
  return FOCUS_VALUES.includes(value as Focus);
}
