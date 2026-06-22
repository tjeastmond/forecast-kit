import { Database } from 'bun:sqlite';
import { sql } from 'drizzle-orm';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema/index.js';

export type DatabaseClient = BunSQLiteDatabase<typeof schema>;

export function createDatabase(dbPath: string): DatabaseClient {
  const sqlite = new Database(dbPath, { create: true });
  sqlite.run('PRAGMA journal_mode = WAL;');
  return drizzle(sqlite, { schema });
}

export function checkDatabaseConnection(db: DatabaseClient): boolean {
  try {
    db.run(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
