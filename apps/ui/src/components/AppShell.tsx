'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { SyncAdminButton } from '@/components/SyncAdminDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AppShell({
  children,
  hasUnsavedEdits = false,
  onTitleClick,
}: {
  children: ReactNode;
  hasUnsavedEdits?: boolean;
  onTitleClick?: () => void;
}) {
  const { toggleTheme } = useTheme();

  const title = onTitleClick ? (
    <button type="button" onClick={onTitleClick} className="text-3xl font-bold tracking-tight">
      FORECAST-KIT.
    </button>
  ) : (
    <Link href="/events" className="text-3xl font-bold tracking-tight">
      FORECAST-KIT.
    </Link>
  );

  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-4">
          {title}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="header-toolbar-outline"
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              suppressHydrationWarning
            >
              <MoonIcon className="size-4 dark:hidden" />
              <SunIcon className="hidden size-4 dark:block" />
            </Button>
            <SyncAdminButton hasUnsavedEdits={hasUnsavedEdits} />
          </div>
        </div>
      </header>
      <main className={cn('mx-auto max-w-shell px-4 py-10')}>{children}</main>
    </div>
  );
}
