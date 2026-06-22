import { logger } from '@forcast-kit/core';
import { render } from 'ink';
import React from 'react';
import { parseArgs } from './args.js';
import { runCommand } from './commands/index.js';
import { App } from './ui/App.jsx';
import { SyncApp } from './ui/SyncApp.jsx';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const noUi = args.flags['no-ui'] === true;

  if (noUi || args.command === 'serve' || args.command === 'help' || args.flags.help === true) {
    const result = await runCommand(args);
    if (result.message) {
      process.stdout.write(`${result.message}\n`);
    }
    process.exit(result.exitCode);
  }

  if (args.command === 'sync') {
    const { waitUntilExit } = render(<SyncApp args={args} />);
    await waitUntilExit();
    process.exit(0);
  }

  const result = await runCommand(args);
  const { waitUntilExit } = render(<App message={result.message ?? 'Done.'} />);
  await waitUntilExit();
  process.exit(result.exitCode);
}

main().catch((error: unknown) => {
  logger.error({
    component: 'cli',
    msg: 'unhandled error',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
