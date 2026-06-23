'use client';

import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close Panel"
        className="absolute inset-0 bg-black/20 backdrop-blur-sm dark:bg-black/70"
        onClick={() => {
          onOpenChange(false);
        }}
      />
      {children}
    </div>
  );
}

export function SheetContent({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'bg-popover absolute top-0 right-0 flex h-full w-1/2 flex-col overflow-hidden border-l shadow-2xl',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 z-10"
        onClick={onClose}
        aria-label="Close Panel"
      >
        <XIcon className="size-4" />
      </Button>
      {children}
    </div>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-border border-b p-4 pr-12', className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto p-4', className)} {...props} />;
}
