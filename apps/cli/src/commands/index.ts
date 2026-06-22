import { loadConfig, parseFocusList, setLogLevel } from '@forcast-kit/core';
import { createDatabase, createRepositories, createSyncService } from '@forcast-kit/db';
import { KalshiProvider } from '@forcast-kit/provider-kalshi';
import { getFlagString, hasFlag, HELP_TEXT, type ParsedArgs } from '../args.js';

export interface CommandResult {
  readonly exitCode: number;
  readonly message?: string;
}

export async function runCommand(args: ParsedArgs): Promise<CommandResult> {
  if (hasFlag(args.flags, 'help') || hasFlag(args.flags, 'h') || args.command === 'help') {
    return { exitCode: 0, message: HELP_TEXT };
  }

  if (hasFlag(args.flags, 'verbose')) {
    setLogLevel('debug');
  }

  switch (args.command) {
    case 'sync':
      return runSyncCommand(args);
    case 'list':
      return { exitCode: 0, message: 'list: not implemented (Phase 3)' };
    case 'inspect': {
      const ticker = args.subcommand ?? args.positional[0];
      if (!ticker) {
        return { exitCode: 1, message: 'inspect: missing ticker argument' };
      }
      return { exitCode: 0, message: `inspect ${ticker}: not implemented (Phase 3)` };
    }
    case 'serve':
      return runServeCommand(args);
    case undefined:
      return { exitCode: 0, message: HELP_TEXT };
    default:
      return { exitCode: 1, message: `Unknown command: ${args.command}\n\n${HELP_TEXT}` };
  }
}

async function runSyncCommand(args: ParsedArgs): Promise<CommandResult> {
  if (args.subcommand !== 'kalshi') {
    return {
      exitCode: 1,
      message: 'Usage: forcast-kit sync kalshi [--focus politics] [--exclude sports]',
    };
  }

  const config = loadConfig();
  const db = createDatabase(config.FORCAST_KIT_DB_PATH);
  const repos = createRepositories(db);
  const syncService = createSyncService(repos);
  const provider = new KalshiProvider(config);

  const focus = parseFocusList(getFlagString(args.flags, 'focus'));
  const exclude = parseFocusList(getFlagString(args.flags, 'exclude'));

  const maxPagesFlag = getFlagString(args.flags, 'max-pages');
  const maxPages = maxPagesFlag ? Number.parseInt(maxPagesFlag, 10) : undefined;

  const result = await syncService.syncProvider(provider, {
    focus,
    exclude,
    ...(maxPages !== undefined && Number.isFinite(maxPages) ? { maxPages } : {}),
  });

  return {
    exitCode: result.status === 'failed' ? 1 : 0,
    message: `Sync complete (run #${String(result.syncRunId)}): ${String(result.eventsUpserted)} events, ${String(result.marketsUpserted)} markets, ${String(result.errorsCount)} errors, status=${result.status}`,
  };
}

async function runServeCommand(args: ParsedArgs): Promise<CommandResult> {
  const port = getFlagString(args.flags, 'port');
  if (port) {
    process.env.FORCAST_KIT_API_PORT = port;
  }

  const { startServer } = await import('@forcast-kit/api');
  await startServer();
  return { exitCode: 0 };
}
