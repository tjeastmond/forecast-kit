import { pickDefined } from '@forecast-kit/core';
import type { FastifyPluginCallback } from 'fastify';
import { focusTagsUpdateSchema, marketPartialUpdateSchema } from '../schemas/admin.js';

const DEFAULT_PROVIDER = 'kalshi' as const;

export const adminRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.patch('/admin/markets/:ticker', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const parsed = marketPartialUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid request body', details: parsed.error.flatten() };
    }

    const body = parsed.data;
    const marketId = await app.repos.markets.updatePartial(
      ticker,
      pickDefined({
        title: body.title,
        subtitle: body.subtitle,
        status: body.status,
        yesBid: body.yesBid,
        yesAsk: body.yesAsk,
        noBid: body.noBid,
        noAsk: body.noAsk,
        lastPrice: body.lastPrice,
        isStale: body.isStale,
      }),
    );
    if (marketId === null) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    return market;
  });

  app.put('/admin/markets/:ticker/focus-tags', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const parsed = focusTagsUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid request body', details: parsed.error.flatten() };
    }

    const marketId = await app.repos.markets.getIdByTicker(ticker);
    if (marketId === null) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    await app.repos.marketFocusTags.replaceTags(marketId, parsed.data.focusTags);

    const updated = await app.query.markets.getMarketByTicker(ticker);
    if (!updated) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    return updated;
  });

  app.put('/admin/events/:eventTicker/pin', async (request, reply) => {
    const { eventTicker } = request.params as { eventTicker: string };
    const event = await app.query.events.getEventByTicker(eventTicker);
    if (!event) {
      reply.code(404);
      return { error: 'Event not found' };
    }

    await app.repos.pins.pin(DEFAULT_PROVIDER, 'event', eventTicker);
    const updated = await app.query.events.getEventByTicker(eventTicker);
    if (!updated) {
      reply.code(404);
      return { error: 'Event not found' };
    }

    return updated;
  });

  app.delete('/admin/events/:eventTicker/pin', async (request, reply) => {
    const { eventTicker } = request.params as { eventTicker: string };
    const event = await app.query.events.getEventByTicker(eventTicker);
    if (!event) {
      reply.code(404);
      return { error: 'Event not found' };
    }

    await app.repos.pins.unpin(DEFAULT_PROVIDER, 'event', eventTicker);
    const updated = await app.query.events.getEventByTicker(eventTicker);
    if (!updated) {
      reply.code(404);
      return { error: 'Event not found' };
    }

    return updated;
  });

  app.put('/admin/markets/:ticker/pin', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    await app.repos.pins.pin(DEFAULT_PROVIDER, 'market', ticker);
    const updated = await app.query.markets.getMarketByTicker(ticker);
    if (!updated) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    return updated;
  });

  app.delete('/admin/markets/:ticker/pin', async (request, reply) => {
    const { ticker } = request.params as { ticker: string };
    const market = await app.query.markets.getMarketByTicker(ticker);
    if (!market) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    await app.repos.pins.unpin(DEFAULT_PROVIDER, 'market', ticker);
    const updated = await app.query.markets.getMarketByTicker(ticker);
    if (!updated) {
      reply.code(404);
      return { error: 'Market not found' };
    }

    return updated;
  });

  done();
};
