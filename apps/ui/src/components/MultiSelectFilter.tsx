'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FILTER_TRIGGER_BUTTON_CLASS } from '@/lib/filterControls';
import { toggleSetSelection } from '@/lib/filterControls';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, ListFilterIcon } from 'lucide-react';

type MultiSelectFilterItem<T extends string> = {
  value: T;
  label: ReactNode;
};

export function MultiSelectFilter<T extends string>({
  items,
  selected,
  onSelectedChange,
  emptyLabel,
  pluralNoun,
  disabled = false,
  className,
}: {
  items: MultiSelectFilterItem<T>[];
  selected: Set<T>;
  onSelectedChange: (next: Set<T>) => void;
  emptyLabel: string;
  pluralNoun: string;
  groupLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = selected.size;
  const singleValue = activeCount === 1 ? selected.values().next().value : undefined;
  const label =
    activeCount === 0
      ? emptyLabel
      : activeCount === 1 && singleValue !== undefined
        ? (items.find((item) => item.value === singleValue)?.label ?? singleValue)
        : `${String(activeCount)} ${pluralNoun}`;

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        disabled={disabled}
        className={FILTER_TRIGGER_BUTTON_CLASS}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <ListFilterIcon className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDownIcon className={cn('size-3.5 shrink-0 opacity-70 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close Filter Menu"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div className="bg-popover absolute top-full z-50 mt-1 w-full rounded-lg border p-2 shadow-lg">
            {items.map((item) => (
              <label
                key={item.value}
                className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.value)}
                  onChange={(event) => {
                    onSelectedChange(toggleSetSelection(selected, item.value, event.target.checked));
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
