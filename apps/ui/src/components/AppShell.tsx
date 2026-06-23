'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoonIcon, SunIcon } from 'lucide-react';
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
  const pathname = usePathname();

  const title = onTitleClick ? (
    <button type="button" onClick={onTitleClick} className="text-3xl font-bold tracking-tight">
      FORCAST-KIT.
    </button>
  ) : (
    <Link href="/events" className="text-3xl font-bold tracking-tight">
      FORCAST-KIT.
    </Link>
  );

  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          {title}
          <div className="flex items-center gap-2">
            <nav className="flex gap-1">
              <Link href="/events">
                <Button variant={pathname.startsWith('/events') ? 'default' : 'outline'} size="default">
                  Events
                </Button>
              </Link>
              <Link href="/markets">
                <Button variant={pathname.startsWith('/markets') ? 'default' : 'outline'} size="default">
                  Markets
                </Button>
              </Link>
            </nav>
            <Button
              variant="outline"
              size="icon"
              className="header-toolbar-outline"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              <MoonIcon className="size-4 dark:hidden" />
              <SunIcon className="hidden size-4 dark:block" />
            </Button>
            <SyncAdminButton hasUnsavedEdits={hasUnsavedEdits} />
          </div>
        </div>
      </header>
      <main className={cn('mx-auto max-w-3xl px-4 py-10')}>{children}</main>
    </div>
  );
}
