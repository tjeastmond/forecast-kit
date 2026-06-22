import { loadConfig, parseFocusList } from '@forcast-kit/core';
import { createDatabase, createRepositories, createSyncService } from '@forcast-kit/db';
import { KalshiProvider } from '@forcast-kit/provider-kalshi';
import { getFlagString, type ParsedArgs } from '../args.js';
import type { CommandResult } from './index.js';

export async function runSyncCommand(args: ParsedArgs): Promise<CommandResult> {
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
