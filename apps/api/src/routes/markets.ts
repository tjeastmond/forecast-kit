import type { Focus } from '@forcast-kit/core';
import { parseFocusList } from '@forcast-kit/core';
import type { FastifyPluginCallback } from 'fastify';

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMarketQuery(query: Record<string, unknown>) {
  return {
    focus: parseFocusList(typeof query['focus'] === 'string' ? query['focus'] : undefined),
    exclude: parseFocusList(typeof query['exclude'] === 'string' ? query['exclude'] : undefined),
    status: typeof query['status'] === 'string' ? query['status'] : undefined,
    q: typeof query['q'] === 'string' ? query['q'] : undefined,
    limit: parseLimit(typeof query['limit'] === 'string' ? query['limit'] : undefined),
    cursor: typeof query['cursor'] === 'string' ? query['cursor'] : undefined,
  };
}

export const marketRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/markets', async (request) => {
    const query = parseMarketQuery(request.query as Record<string, unknown>);
    const result = await app.query.markets.listMarkets({
      ...(query.focus.length > 0 ? { focus: query.focus } : {}),
      ...(query.exclude.length > 0 ? { exclude: query.exclude } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
    });
    return result;
  });

  app.get('/markets/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }
    return market;
  });

  done();
};

export const eventRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/events', async (request) => {
    const query = request.query as Record<string, unknown>;
    const marketQuery = parseMarketQuery(query);
    const includeMarkets = query['includeMarkets'] === 'true' || query['includeMarkets'] === true;

    return app.query.events.listEvents({
      ...(marketQuery.focus.length > 0 ? { focus: marketQuery.focus } : {}),
      ...(marketQuery.exclude.length > 0 ? { exclude: marketQuery.exclude } : {}),
      ...(marketQuery.q !== undefined ? { q: marketQuery.q } : {}),
      ...(marketQuery.limit !== undefined ? { limit: marketQuery.limit } : {}),
      ...(marketQuery.cursor !== undefined ? { cursor: marketQuery.cursor } : {}),
      includeMarkets,
    });
  });

  app.get('/events/:eventTicker', async (request, reply) => {
    const { eventTicker } = request.params as { eventTicker: string };
    const query = parseMarketQuery(request.query as Record<string, unknown>);
    const event = await app.query.events.getEventByTicker(eventTicker, {
      ...(query.focus.length > 0 ? { focus: query.focus } : {}),
      ...(query.exclude.length > 0 ? { exclude: query.exclude } : {}),
    });
    if (!event) {
      reply.code(404);
      return { error: 'Event not found' };
    }
    return event;
  });

  done();
};

interface SyncBody {
  provider?: string;
  focus?: Focus[];
  exclude?: Focus[];
  full?: boolean;
  maxPages?: number;
}

export const syncRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post('/sync', async (request) => {
    const body = (request.body ?? {}) as SyncBody;
    const provider = body.provider ?? 'kalshi';

    if (provider !== 'kalshi') {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const { syncRunId } = await app.sync.startBackgroundSync(app.kalshiProvider, {
      ...(body.focus !== undefined ? { focus: body.focus } : {}),
      ...(body.exclude !== undefined ? { exclude: body.exclude } : {}),
      ...(body.maxPages !== undefined ? { maxPages: body.maxPages } : {}),
    });

    return { syncRunId, status: 'running' };
  });

  app.get('/sync/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const syncRunId = Number.parseInt(id, 10);
    if (!Number.isFinite(syncRunId)) {
      reply.code(400);
      return { error: 'Invalid sync run id' };
    }

    const syncRun = await app.query.syncRuns.getById(syncRunId);
    if (!syncRun) {
      reply.code(404);
      return { error: 'Sync run not found' };
    }

    return syncRun;
  });

  done();
};
