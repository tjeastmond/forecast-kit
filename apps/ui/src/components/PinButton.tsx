'use client';

import { PinIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { pinEvent, pinMarket, unpinEvent, unpinMarket } from '@/lib/api';
import { cn } from '@/lib/utils';

type PinTarget = 'event' | 'market';

export function PinButton({
  targetType,
  ticker,
  pinned,
  onPinChange,
  className,
}: {
  targetType: PinTarget;
  ticker: string;
  pinned: boolean;
  onPinChange?: (nextPinned: boolean) => void;
  className?: string;
}) {
  const [isPinned, setIsPinned] = useState(pinned);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setIsPinned(pinned);
  }, [pinned]);

  const labelPrefix = targetType === 'event' ? 'Event' : 'Market';

  const toggle = useCallback(async () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    setPending(true);
    try {
      if (targetType === 'event') {
        if (nextPinned) {
          await pinEvent(ticker);
        } else {
          await unpinEvent(ticker);
        }
      } else if (nextPinned) {
        await pinMarket(ticker);
      } else {
        await unpinMarket(ticker);
      }
      onPinChange?.(nextPinned);
    } catch (error) {
      setIsPinned(!nextPinned);
      toast.error(error instanceof Error ? error.message : 'Failed to update pin');
    } finally {
      setPending(false);
    }
  }, [isPinned, onPinChange, targetType, ticker]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn('header-toolbar-outline', className)}
      aria-label={isPinned ? `Unpin ${labelPrefix}` : `Pin ${labelPrefix}`}
      aria-pressed={isPinned}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
    >
      <PinIcon className={cn('size-4', isPinned ? 'fill-current' : undefined)} />
    </Button>
  );
}
