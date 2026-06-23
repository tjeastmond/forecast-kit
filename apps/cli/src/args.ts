export interface ParsedArgs {
  readonly command: string | undefined;
  readonly subcommand: string | undefined;
  readonly positional: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
  let subcommand: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }

    if (arg.startsWith('-') && arg.length === 2) {
      flags[arg.slice(1)] = true;
      continue;
    }

    if (command === undefined) {
      command = arg;
      continue;
    }

    if (subcommand === undefined) {
      subcommand = arg;
      continue;
    }

    positional.push(arg);
  }

  return { command, subcommand, positional, flags };
}

export function getFlagString(flags: Readonly<Record<string, string | boolean>>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

export function hasFlag(flags: Readonly<Record<string, string | boolean>>, key: string): boolean {
  return flags[key] === true || typeof flags[key] === 'string';
}

export const HELP_TEXT = `forecast-kit — Kalshi market data CLI

Usage:
  forecast-kit sync kalshi [options]   Sync open markets from Kalshi
  forecast-kit list [options]          List stored markets
  forecast-kit events [eventTicker]    List events or show event detail (alias: event)
  forecast-kit inspect <ticker>        Show market detail
  forecast-kit serve [options]         Start the local API server

Options:
  --focus <tags>      Comma-separated focus tags (politics, weather, ...)
  --exclude <tags>    Comma-separated focus tags to exclude
  --category <name>   Filter by Kalshi category (from synced taxonomy)
  --tag <name>        Filter by Kalshi series tag (from synced taxonomy)
  --status <status>   Filter by market status
  --limit <n>         Max rows for list/events (default 50)
  --full              Full sync (fetch all pages, mark unseen markets stale)
  --max-pages <n>     Limit Kalshi pagination during sync
  --port <number>     API port (serve command)
  --no-ui             Disable Ink UI (sync command)
  --verbose           Enable debug logging
  --help, -h          Show this help
`;
