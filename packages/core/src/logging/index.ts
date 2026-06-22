export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  readonly component?: string;
  readonly provider?: string;
  readonly page?: number;
  readonly markets?: number;
  readonly msg?: string;
  readonly [key: string]: unknown;
}

let currentLevel: LogLevel = 'info';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function writeLog(level: LogLevel, fields: LogFields): void {
  if (!shouldLog(level)) return;
  const payload = { level, ...fields };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

export const logger = {
  debug(fields: LogFields): void {
    writeLog('debug', fields);
  },
  info(fields: LogFields): void {
    writeLog('info', fields);
  },
  warn(fields: LogFields): void {
    writeLog('warn', fields);
  },
  error(fields: LogFields): void {
    writeLog('error', fields);
  },
};
