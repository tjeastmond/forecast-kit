import { setLogLevel } from '@forcast-kit/core';
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

function runSyncCommand(args: ParsedArgs): CommandResult {
  if (args.subcommand !== 'kalshi') {
    return {
      exitCode: 1,
      message: 'Usage: forcast-kit sync kalshi [--focus politics] [--exclude sports]',
    };
  }

  const focus = getFlagString(args.flags, 'focus');
  const exclude = getFlagString(args.flags, 'exclude');
  const parts = ['sync kalshi: not implemented (Phase 2)'];
  if (focus) parts.push(`focus=${focus}`);
  if (exclude) parts.push(`exclude=${exclude}`);
  return { exitCode: 0, message: parts.join(' ') };
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
