import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { DatabaseClient } from './database-client.js';
import * as schema from './schema/index.js';

export function createTestDatabase(): DatabaseClient {
  const sqlite = new Database(':memory:');
  const migrationDir = join(dirname(fileURLToPath(import.meta.url)), '../migrations');
  sqlite.exec(readFileSync(join(migrationDir, '0000_omniscient_kree.sql'), 'utf8'));
  sqlite.exec(readFileSync(join(migrationDir, '0001_add_market_stale.sql'), 'utf8'));
  sqlite.exec(readFileSync(join(migrationDir, '0002_add_kalshi_taxonomy.sql'), 'utf8'));
  sqlite.exec(readFileSync(join(migrationDir, '0003_add_pinned_items.sql'), 'utf8'));
  sqlite.exec('PRAGMA foreign_keys = ON;');
  return drizzle(sqlite, { schema }) as unknown as DatabaseClient;
}
