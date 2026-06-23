import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { ParsedArgs } from '../args.js';
import { runSyncCommand } from '../commands/sync.js';

interface SyncAppProps {
  readonly args: ParsedArgs;
}

export function SyncApp({ args }: SyncAppProps) {
  const [message, setMessage] = useState('Syncing Kalshi markets…');
  const [exitCode, setExitCode] = useState(0);

  useEffect(() => {
    void runSyncCommand(args).then((result) => {
      setMessage(result.message ?? 'Sync finished.');
      setExitCode(result.exitCode);
    });
  }, [args]);

  return (
    <Box flexDirection="column">
      <Text bold>forecast-kit sync</Text>
      <Text>{message}</Text>
      {exitCode !== 0 ? <Text color="red">Exit code: {String(exitCode)}</Text> : null}
    </Box>
  );
}
