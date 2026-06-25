import type { Focus, ProviderId } from '@forecast-kit/core';
import { deriveMarketMetrics, parseFocusList, pickDefined } from '@forecast-kit/core';
import { marketDetailToExport } from '@forecast-kit/db/export';
import type { FastifyPluginCallback } from 'fastify';
import { parseLimit } from '../utils.js';

function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return undefined;
}

function parseMarketQuery(query: Record<string, unknown>) {
  return {
    focus: parseFocusList(typeof query['focus'] === 'string' ? query['focus'] : undefined),
    exclude: parseFocusList(typeof query['exclude'] === 'string' ? query['exclude'] : undefined),
    category: typeof query['category'] === 'string' ? query['category'] : undefined,
    tag: typeof query['tag'] === 'string' ? query['tag'] : undefined,
    status: typeof query['status'] === 'string' ? query['status'] : undefined,
    stale: parseBoolean(query['stale']),
    q: typeof query['q'] === 'string' ? query['q'] : undefined,
    limit: parseLimit(typeof query['limit'] === 'string' ? query['limit'] : undefined),
    cursor: typeof query['cursor'] === 'string' ? query['cursor'] : undefined,
    includeMetrics: parseBoolean(query['includeMetrics']) === true,
    pinned: parseBoolean(query['pinned']),
  };
}

function toMarketListFilters(query: ReturnType<typeof parseMarketQuery>) {
  return pickDefined({
    focus: query.focus.length > 0 ? query.focus : undefined,
    exclude: query.exclude.length > 0 ? query.exclude : undefined,
    category: query.category,
    tag: query.tag,
    status: query.status,
    stale: query.stale,
    q: query.q,
    limit: query.limit,
    cursor: query.cursor,
  });
}

export const marketRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/markets', async (request) => {
    const query = parseMarketQuery(request.query as Record<string, unknown>);
    const result = await app.query.markets.listMarkets(toMarketListFilters(query));
    return result;
  });

  app.get('/markets/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const query = parseMarketQuery(request.query as Record<string, unknown>);
    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    if (!query.includeMetrics) {
      return market;
    }

    const metrics = deriveMarketMetrics({
      yesBid: market.yesBid,
      yesAsk: market.yesAsk,
      noBid: market.noBid,
      noAsk: market.noAsk,
      lastPrice: market.lastPrice,
    });

    return { ...market, metrics };
  });

  app.get('/markets/:ticker/export', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    return marketDetailToExport(market);
  });

  done();
};

export const eventRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/events', async (request) => {
    const query = request.query as Record<string, unknown>;
    const marketQuery = parseMarketQuery(query);
    const includeMarkets = query['includeMarkets'] === 'true' || query['includeMarkets'] === true;

    return app.query.events.listEvents({
      ...toMarketListFilters(marketQuery),
      includeMarkets,
      ...(marketQuery.pinned === true ? { pinned: true } : {}),
    });
  });

  app.get('/events/:eventTicker', async (request, reply) => {
    const { eventTicker } = request.params as { eventTicker: string };
    const query = parseMarketQuery(request.query as Record<string, unknown>);
    const event = await app.query.events.getEventByTicker(
      eventTicker,
      pickDefined({
        focus: query.focus.length > 0 ? query.focus : undefined,
        exclude: query.exclude.length > 0 ? query.exclude : undefined,
        includeMetrics: query.includeMetrics ? true : undefined,
      }),
    );
    if (!event) {
      reply.code(404);
      return { error: 'Event not found' };
    }
    return event;
  });

  app.post('/events/:eventTicker/sync', async (request) => {
    const { eventTicker } = request.params as { eventTicker: string };
    const body = (request.body ?? {}) as { provider?: string };
    const providerId = (body.provider ?? 'kalshi') as ProviderId;
    const provider = app.providers.require(providerId);

    const { syncRunId } = await app.sync.startBackgroundEventSync(provider, eventTicker);
    return { syncRunId, status: 'running', eventTicker };
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
  app.post('/sync/taxonomy', async (request) => {
    const body = (request.body ?? {}) as { full?: boolean };
    const result = await app.sync.syncTaxonomy(pickDefined({ full: body.full === true ? true : undefined }));
    if (!result) {
      return { status: 'skipped', reason: 'taxonomy sync not configured' };
    }
    return { status: 'success', ...result };
  });

  app.post('/sync', async (request) => {
    const body = (request.body ?? {}) as SyncBody;
    const providerId = (body.provider ?? 'kalshi') as ProviderId;
    const provider = app.providers.require(providerId);

    const { syncRunId } = await app.sync.startBackgroundSync(
      provider,
      pickDefined({
        focus: body.focus,
        exclude: body.exclude,
        maxPages: body.maxPages,
        full: body.full === true ? true : undefined,
      }),
    );

    return { syncRunId, status: 'running' };
  });

  app.get('/sync', async (request) => {
    const query = request.query as Record<string, unknown>;
    const limit = parseLimit(typeof query['limit'] === 'string' ? query['limit'] : undefined);
    const cursor = typeof query['cursor'] === 'string' ? query['cursor'] : undefined;

    return app.query.syncRuns.listRuns(pickDefined({ limit, cursor }));
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
