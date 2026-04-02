import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { register } from '../config/metrics.js';

export default async function metricsRoutes(app: FastifyInstance) {
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', register.contentType);
    const metrics = await register.metrics();
    return reply.send(metrics);
  });
}
