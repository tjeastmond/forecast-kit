'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { SyncAdminButton } from '@/components/SyncAdminDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active
          ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80'
          : 'header-toolbar-outline border-border bg-background hover:bg-muted dark:border-input dark:bg-input/30',
      )}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children, onTitleClick }: { children: ReactNode; onTitleClick?: () => void }) {
  const { toggleTheme } = useTheme();
  const pathname = usePathname();
  const homeActive = pathname === '/';
  const eventsActive = pathname === '/events' || pathname.startsWith('/events/');

  const title = onTitleClick ? (
    <button type="button" onClick={onTitleClick} className="text-3xl font-bold tracking-tight">
      FORECAST-KIT.
    </button>
  ) : (
    <Link href="/" className="text-3xl font-bold tracking-tight">
      FORECAST-KIT.
    </Link>
  );

  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {title}
            <nav className="flex items-center gap-2" aria-label="Primary">
              <NavLink href="/" label="Home" active={homeActive} />
              <NavLink href="/events" label="Events" active={eventsActive} />
            </nav>
          </div>
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
            <SyncAdminButton />
          </div>
        </div>
      </header>
      <main className={cn('mx-auto max-w-shell px-4 py-10')}>{children}</main>
    </div>
  );
}
