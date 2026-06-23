import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

const ALLOWED_ORIGINS = ['http://127.0.0.1:3848', 'http://localhost:3848'];

export const corsPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
};
