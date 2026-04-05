import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const PISTON_URL =
  env.PISTON_URL ||
  (env.NODE_ENV === 'production'
    ? 'https://emkc.org/api/v2/piston/execute'
    : 'http://localhost:10200/api/v2/execute');

export default async function pistonRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  // POST /execute — authenticated proxy for code execution
  app.post('/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ message: 'Invalid request body' });
    }

    try {
      const response = await fetch(PISTON_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      const contentType = response.headers.get('content-type') || 'application/json';

      reply.status(response.status).header('content-type', contentType).send(text);
    } catch {
      reply.status(502).send({ message: 'Code execution service unavailable' });
    }
  });
}
