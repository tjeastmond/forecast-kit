'use client';

import { FOCUS_VALUES } from '@/lib/constants';
import { SearchIcon, XIcon } from 'lucide-react';
import { MultiSelectFilter } from '@/components/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FILTER_ROW_CLASS } from '@/lib/filterControls';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['open', 'closed', 'settled', 'active', 'unopened'] as const;

export interface MarketFilterState {
  searchQuery: string;
  focus: Set<string>;
  exclude: Set<string>;
  status: Set<string>;
  staleOnly: boolean;
}

export function MarketFilters({
  filters,
  onFiltersChange,
  onClear,
  hasActiveFilters,
  searchInputRef,
  variant = 'markets',
}: {
  filters: MarketFilterState;
  onFiltersChange: (next: MarketFilterState) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  variant?: 'markets' | 'events';
}) {
  const searchPlaceholder = variant === 'events' ? 'Search Events…' : 'Search Markets…';
  const searchAriaLabel = variant === 'events' ? 'Search Events' : 'Search Markets';

  return (
    <div className="mb-6 space-y-2">
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          ref={searchInputRef}
          type="search"
          value={filters.searchQuery}
          onChange={(event) => {
            onFiltersChange({ ...filters, searchQuery: event.target.value });
          }}
          placeholder={searchPlaceholder}
          className="pl-8"
          aria-label={searchAriaLabel}
        />
      </div>
      <div className={FILTER_ROW_CLASS}>
        <MultiSelectFilter
          items={FOCUS_VALUES.map((focus) => ({ value: focus, label: focus }))}
          selected={filters.focus}
          onSelectedChange={(focus) => {
            onFiltersChange({ ...filters, focus });
          }}
          emptyLabel="Filter By Focus"
          pluralNoun="focus tags"
        />
        <MultiSelectFilter
          items={FOCUS_VALUES.map((focus) => ({ value: focus, label: focus }))}
          selected={filters.exclude}
          onSelectedChange={(exclude) => {
            onFiltersChange({ ...filters, exclude });
          }}
          emptyLabel="Exclude Focus"
          pluralNoun="excluded"
        />
        <span className={cn(!hasActiveFilters && 'cursor-not-allowed')}>
          <Button
            variant="outline"
            size="icon"
            disabled={!hasActiveFilters}
            onClick={onClear}
            className={cn(hasActiveFilters && 'border-destructive/30 bg-red-50 text-white dark:bg-red-950/40')}
            aria-label="Clear Filters"
          >
            <XIcon className={cn('size-4', hasActiveFilters ? 'text-red-600' : 'text-muted-foreground')} />
          </Button>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          items={STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
          selected={filters.status}
          onSelectedChange={(status) => {
            onFiltersChange({ ...filters, status });
          }}
          emptyLabel="Filter By Status"
          pluralNoun="statuses"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.staleOnly}
            onChange={(event) => {
              onFiltersChange({ ...filters, staleOnly: event.target.checked });
            }}
          />
          Stale Only
        </label>
      </div>
      <hr className="border-border" />
    </div>
  );
}

export function filtersToQueryParams(filters: MarketFilterState): {
  focus?: string;
  exclude?: string;
  status?: string;
  stale?: boolean;
  q?: string;
} {
  return {
    ...(filters.focus.size > 0 ? { focus: [...filters.focus].join(',') } : {}),
    ...(filters.exclude.size > 0 ? { exclude: [...filters.exclude].join(',') } : {}),
    ...(filters.status.size === 1 ? { status: [...filters.status][0] } : {}),
    ...(filters.staleOnly ? { stale: true } : {}),
    ...(filters.searchQuery.trim() ? { q: filters.searchQuery.trim() } : {}),
  };
}

export function hasActiveMarketFilters(filters: MarketFilterState): boolean {
  return (
    filters.searchQuery.trim().length > 0 ||
    filters.focus.size > 0 ||
    filters.exclude.size > 0 ||
    filters.status.size > 0 ||
    filters.staleOnly
  );
}

export const emptyMarketFilters = (): MarketFilterState => ({
  searchQuery: '',
  focus: new Set(),
  exclude: new Set(),
  status: new Set(),
  staleOnly: false,
});
