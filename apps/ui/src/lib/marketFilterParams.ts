import { emptyMarketFilters, filtersToQueryParams, type MarketFilterState } from '@/lib/marketFilters';

export const EVENT_LIST_PAGE_SIZES = [5, 10, 20, 50] as const;
export type EventListPageSize = (typeof EVENT_LIST_PAGE_SIZES)[number];

export const DEFAULT_EVENT_LIST_PAGE_SIZE: EventListPageSize = 10;
export const LIST_LIMIT_STORAGE_KEY = 'forecast-kit-list-limit';
export const EVENTS_LIST_RETURN_KEY = 'forecast-kit-events-list-return';
export const PINNED_LIST_RETURN_KEY = 'forecast-kit-pinned-list-return';
export const LIST_ORIGIN_KEY = 'forecast-kit-list-origin';

const PAGE_SIZE_SET = new Set<number>(EVENT_LIST_PAGE_SIZES);

export interface EventListParams {
  readonly filters: MarketFilterState;
  readonly pageSize: EventListPageSize;
  readonly cursor: string | null;
}

function parseSetParam(value: string | null): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function serializeSetParam(values: Set<string>): string | undefined {
  if (values.size === 0) {
    return undefined;
  }
  return [...values].sort().join(',');
}

export function isEventListPageSize(value: number): value is EventListPageSize {
  return PAGE_SIZE_SET.has(value);
}

export function readStoredPageSize(): EventListPageSize | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const stored = window.localStorage.getItem(LIST_LIMIT_STORAGE_KEY);
    if (stored === null) {
      return undefined;
    }
    const parsed = Number.parseInt(stored, 10);
    return isEventListPageSize(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredPageSize(pageSize: EventListPageSize): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LIST_LIMIT_STORAGE_KEY, String(pageSize));
  } catch {
    // localStorage may be unavailable
  }
}

export function cursorStacksEqual(left: readonly (string | null)[], right: readonly (string | null)[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function resolveCursorStack(
  cursor: string | null,
  storedStack: readonly (string | null)[] | undefined,
): (string | null)[] {
  if (storedStack !== undefined && storedStack.length > 0) {
    const top = storedStack[storedStack.length - 1] ?? null;
    if (top === cursor) {
      return [...storedStack];
    }
  }
  if (cursor === null) {
    return [null];
  }
  return [null, cursor];
}

export function saveEventsListReturn(queryString: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(EVENTS_LIST_RETURN_KEY, queryString);
    window.sessionStorage.setItem(LIST_ORIGIN_KEY, 'events');
  } catch {
    // sessionStorage may be unavailable
  }
}

export function savePinnedListReturn(queryString: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(PINNED_LIST_RETURN_KEY, queryString);
    window.sessionStorage.setItem(LIST_ORIGIN_KEY, 'pinned');
  } catch {
    // sessionStorage may be unavailable
  }
}

export function readEventsListReturn(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.sessionStorage.getItem(EVENTS_LIST_RETURN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function readPinnedListReturn(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return window.sessionStorage.getItem(PINNED_LIST_RETURN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function readListBackLink(): { href: string; label: string } {
  if (typeof window === 'undefined') {
    return { href: '/events', label: 'Events' };
  }
  try {
    const origin = window.sessionStorage.getItem(LIST_ORIGIN_KEY);
    if (origin === 'pinned') {
      return { href: `/${readPinnedListReturn()}`, label: 'Pinned' };
    }
  } catch {
    // sessionStorage may be unavailable
  }
  return { href: `/events${readEventsListReturn()}`, label: 'Events' };
}

export function parseEventListParams(
  searchParams: URLSearchParams,
  options?: { storedPageSize?: EventListPageSize },
): EventListParams {
  const limitRaw = searchParams.get('limit');
  const parsedLimit = limitRaw === null ? undefined : Number.parseInt(limitRaw, 10);
  const pageSize =
    parsedLimit !== undefined && isEventListPageSize(parsedLimit)
      ? parsedLimit
      : (options?.storedPageSize ?? DEFAULT_EVENT_LIST_PAGE_SIZE);

  return {
    filters: {
      searchQuery: searchParams.get('q') ?? '',
      focus: parseSetParam(searchParams.get('focus')),
      category: parseSetParam(searchParams.get('category')),
      tag: parseSetParam(searchParams.get('tag')),
      status: parseSetParam(searchParams.get('status')),
    },
    pageSize,
    cursor: searchParams.get('cursor'),
  };
}

export function serializeEventListParams(params: EventListParams): URLSearchParams {
  const next = new URLSearchParams();
  const { filters, pageSize, cursor } = params;

  const trimmedQuery = filters.searchQuery.trim();
  if (trimmedQuery.length > 0) {
    next.set('q', trimmedQuery);
  }

  const focus = serializeSetParam(filters.focus);
  if (focus !== undefined) {
    next.set('focus', focus);
  }

  const category = serializeSetParam(filters.category);
  if (category !== undefined) {
    next.set('category', category);
  }

  const tag = serializeSetParam(filters.tag);
  if (tag !== undefined) {
    next.set('tag', tag);
  }

  const status = serializeSetParam(filters.status);
  if (status !== undefined) {
    next.set('status', status);
  }

  if (pageSize !== DEFAULT_EVENT_LIST_PAGE_SIZE) {
    next.set('limit', String(pageSize));
  }

  if (cursor !== null && cursor.length > 0) {
    next.set('cursor', cursor);
  }

  return next;
}

export function buildEventsListCacheKey(params: EventListParams, options?: { pinned?: boolean }): string {
  const serialized = serializeEventListParams(params);
  const entries = [...serialized.entries()].sort(([left], [right]) => left.localeCompare(right));
  const base = entries.map(([key, value]) => `${key}=${value}`).join('&');
  return options?.pinned === true ? `pinned:${base}` : base;
}

export function buildEventsFetchOptions(
  params: EventListParams,
  options?: { pinned?: boolean },
): {
  focus?: string;
  category?: string;
  tag?: string;
  status?: string;
  q?: string;
  limit: number;
  cursor?: string;
  includeMarkets: true;
  pinned?: boolean;
} {
  const query = filtersToQueryParams(params.filters);
  return {
    ...query,
    limit: params.pageSize,
    includeMarkets: true,
    ...(options?.pinned === true ? { pinned: true } : {}),
    ...(params.cursor !== null && params.cursor.length > 0 && options?.pinned !== true
      ? { cursor: params.cursor }
      : {}),
  };
}

export function emptyEventListParams(): EventListParams {
  return {
    filters: emptyMarketFilters(),
    pageSize: DEFAULT_EVENT_LIST_PAGE_SIZE,
    cursor: null,
  };
}

export function parseFiltersFromSearchParams(searchParams: URLSearchParams): MarketFilterState {
  return parseEventListParams(searchParams).filters;
}

const FILTER_PARAM_KEYS = ['q', 'focus', 'category', 'tag', 'status'] as const;

export function mergeFiltersIntoSearchParams(current: URLSearchParams, filters: MarketFilterState): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of FILTER_PARAM_KEYS) {
    next.delete(key);
  }

  const serialized = serializeEventListParams({
    filters,
    pageSize: DEFAULT_EVENT_LIST_PAGE_SIZE,
    cursor: null,
  });

  for (const [key, value] of serialized.entries()) {
    if (key !== 'limit' && key !== 'cursor') {
      next.set(key, value);
    }
  }

  return next;
}
