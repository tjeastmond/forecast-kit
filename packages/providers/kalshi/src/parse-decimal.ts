export function parseDecimal(value: string | undefined | null): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDecimalOrNull(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
