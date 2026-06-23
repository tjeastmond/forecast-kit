'use client';

import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyIdRow({
  id,
  label,
  copyAriaLabel,
  onCopy,
}: {
  id: string;
  label?: string;
  copyAriaLabel: string;
  onCopy: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <span className="text-muted-foreground font-mono text-xs">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-6"
        aria-label={copyAriaLabel}
        onClick={() => {
          onCopy(id);
        }}
      >
        <CopyIcon className="size-3.5" />
      </Button>
    </div>
  );
}
