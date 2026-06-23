import { setLogLevel } from '@forecast-kit/core';
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
      return (await import('./sync.js')).runSyncCommand(args);
    case 'list':
      return (await import('./list.js')).runListCommand(args);
    case 'events':
    case 'event':
      return (await import('./events.js')).runEventsCommand(args);
    case 'inspect':
      return (await import('./list.js')).runInspectCommand(args);
    case 'serve':
      return runServeCommand(args);
    case undefined:
      return { exitCode: 0, message: HELP_TEXT };
    default:
      return { exitCode: 1, message: `Unknown command: ${args.command}\n\n${HELP_TEXT}` };
  }
}

async function runServeCommand(args: ParsedArgs): Promise<CommandResult> {
  const port = getFlagString(args.flags, 'port');
  if (port) {
    process.env.FORECAST_KIT_API_PORT = port;
  }

  const { startServer } = await import('@forecast-kit/api');
  await startServer();
  return { exitCode: 0 };
}
