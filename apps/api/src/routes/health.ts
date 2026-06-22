import { checkDatabaseConnection } from '@forcast-kit/db';
import type { FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/health', () => {
    const dbConnected = checkDatabaseConnection(app.db);
    return {
      status: 'ok',
      db: dbConnected ? 'connected' : 'disconnected',
    };
  });
  done();
};
