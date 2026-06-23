export function marketDisplayTitle(market: { readonly title: string; readonly subtitle: string }): string {
  const subtitle = market.subtitle.trim();
  return subtitle.length > 0 ? subtitle : market.title;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSpread(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${(value * 100).toFixed(2)}¢`;
}
