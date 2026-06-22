import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { DatabaseClient } from './database-client.js';
import * as schema from './schema/index.js';

export function createTestDatabase(): DatabaseClient {
  const sqlite = new Database(':memory:');
  const migrationPath = join(dirname(fileURLToPath(import.meta.url)), '../migrations/0000_omniscient_kree.sql');
  sqlite.exec(readFileSync(migrationPath, 'utf8'));
  return drizzle(sqlite, { schema }) as unknown as DatabaseClient;
}
