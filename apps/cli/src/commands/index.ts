import { setLogLevel } from '@forcast-kit/core';
import { getFlagString, hasFlag, HELP_TEXT, type ParsedArgs } from '../args.js';
import { runInspectCommand, runListCommand } from './list.js';
import { runSyncCommand } from './sync.js';

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
      return runListCommand(args);
    case 'inspect':
      return runInspectCommand(args);
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
    process.env.FORCAST_KIT_API_PORT = port;
  }

  const { startServer } = await import('@forcast-kit/api');
  await startServer();
  return { exitCode: 0 };
}
