import React from 'react';
import { Box, Text } from 'ink';

interface AppProps {
  readonly message: string;
}

export function App({ message }: AppProps) {
  return (
    <Box flexDirection="column">
      <Text bold>forecast-kit</Text>
      <Text>{message}</Text>
    </Box>
  );
}
