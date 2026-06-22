import { loadConfig, logger } from '@forcast-kit/core';
import { checkDatabaseConnection, createDatabase } from '@forcast-kit/db';
import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';

export async function buildApp() {
  const config = loadConfig();
  const db = createDatabase(config.FORCAST_KIT_DB_PATH);

  const app = Fastify({ logger: false });

  app.decorate('config', config);
  app.decorate('db', db);

  await app.register(healthRoutes);

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
