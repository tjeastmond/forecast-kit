import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type * as schema from './schema/index.js';

export type DatabaseClient = BunSQLiteDatabase<typeof schema>;
