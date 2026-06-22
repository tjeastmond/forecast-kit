import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/db/src/schema/index.ts',
  out: './packages/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.FORCAST_KIT_DB_PATH ?? './data/forcast-kit.db',
  },
});
