import { loadConfig, logger } from '@forcast-kit/core';
import type { DatabaseClient } from '@forcast-kit/db';
import {
  checkDatabaseConnection,
  createDatabase,
  createQueryServices,
  createRepositories,
  createSyncService,
} from '@forcast-kit/db';
import { KalshiProvider } from '@forcast-kit/provider-kalshi';
import Fastify from 'fastify';
import { eventRoutes, marketRoutes, syncRoutes } from './routes/markets.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(options?: { db?: DatabaseClient }) {
  const config = loadConfig();
  const db = options?.db ?? createDatabase(config.FORCAST_KIT_DB_PATH);
  const repos = createRepositories(db);
  const query = createQueryServices(db);
  const sync = createSyncService(repos);
  const kalshiProvider = new KalshiProvider(config);

  const app = Fastify({ logger: false });

  app.decorate('config', config);
  app.decorate('db', db);
  app.decorate('query', query);
  app.decorate('sync', sync);
  app.decorate('kalshiProvider', kalshiProvider);

  await app.register(healthRoutes);
  await app.register(marketRoutes);
  await app.register(eventRoutes);
  await app.register(syncRoutes);

  return app;
}

export async function startServer() {
  const config = loadConfig();
  const app = await buildApp();

  const dbConnected = checkDatabaseConnection(app.db);
  if (!dbConnected) {
    logger.warn({ component: 'api', msg: 'database connection check failed at startup' });
  }

  await app.listen({
    host: config.FORCAST_KIT_API_HOST,
    port: config.FORCAST_KIT_API_PORT,
  });

  logger.info({
    component: 'api',
    msg: 'server listening',
    host: config.FORCAST_KIT_API_HOST,
    port: config.FORCAST_KIT_API_PORT,
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof loadConfig>;
    db: ReturnType<typeof createDatabase>;
    query: ReturnType<typeof createQueryServices>;
    sync: ReturnType<typeof createSyncService>;
    kalshiProvider: KalshiProvider;
  }
}

if (import.meta.main) {
  startServer().catch((error: unknown) => {
    logger.error({
      component: 'api',
      msg: 'failed to start server',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
