// src/app.ts
// Fastify application builder — Phase 0 + Phase 1.
// Justification: implementation-roadmap.md Steps 0.7, 1.6
//
// Registers security plugins (Helmet, CORS, Cookie, Rate-Limit),
// sets the centralized error handler, registers auth routes,
// and exposes health endpoints.

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { redis } from './config/redis.js';
import { prisma } from './config/database.js';
import { httpRequestDurationMicroseconds } from './config/metrics.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import progressRoutes from './routes/progress.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import adminRoutes from './routes/admin.routes.js';
import bulkStudentRoutes from './routes/bulkStudent.routes.js';
import bulkProblemsRoutes from './routes/bulkProblems.routes.js';
import teacherProblemsRoutes from './routes/teacherProblems.routes.js';
import studentProblemsRoutes from './routes/studentProblems.routes.js';
import roadmapRoutes from './routes/roadmap.routes.js';
import sessionsRoutes from './routes/sessions.routes.js';
import pistonRoutes from './routes/piston.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import { runPreflightChecks } from './services/preflight.service.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  });

  // --- Security plugins ---
  // Backend-DevSkill.md: "Helmet for security headers"
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  // Backend-DevSkill.md: "CORS configured explicitly"
  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Needed for httpOnly refresh token cookies
  await app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  // Backend-DevSkill.md: "Rate limiting per route"
  await app.register(rateLimit, {
    global: false, // rate limits defined per-route in auth.routes.ts
  });

  // File upload support for CSV import
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
  });

  // --- Prometheus HTTP tracking ---
  app.addHook('onRequest', (request, _reply, done) => {
    (request as any).startTime = process.hrtime();
    done();
  });
  app.addHook('onResponse', (request, reply, done) => {
    const startTime: [number, number] | undefined = (request as any).startTime;
    if (startTime) {
      const diff = process.hrtime(startTime);
      const timeInMs = diff[0] * 1000 + diff[1] / 1e6;
      const route = request.routeOptions.url || request.url;
      httpRequestDurationMicroseconds
        .labels(request.method, route, reply.statusCode.toString())
        .observe(timeInMs);
    }
    done();
  });

  // --- Error handling ---
  app.setErrorHandler(errorHandler);

  // --- Redis lifecycle ---
  app.addHook('onReady', async () => {
    await redis.connect();
    app.log.info('Redis connected');
  });

  app.addHook('onClose', async () => {
    await redis.quit();
    app.log.info('Redis disconnected');
  });

  const getHealthResponse = async () => {
    const dbHealthy = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

    const redisHealthy = await redis
      .ping()
      .then((pong) => pong === 'PONG')
      .catch(() => false);

    const status = dbHealthy && redisHealthy ? 'ok' : 'degraded';
    const code = status === 'ok' ? 200 : 503;

    return {
      code,
      payload: {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        redis: redisHealthy ? 'connected' : 'disconnected',
        services: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          redis: redisHealthy ? 'healthy' : 'unhealthy',
        },
      },
    };
  };

  // --- API prefix: all routes under /api ---
  await app.register(
    async (api) => {
      // --- Phase 0: Health check ---
      api.get('/health', async (_request, reply) => {
        const { code, payload } = await getHealthResponse();
        return reply.code(code).send(payload);
      });

      // --- Phase 1: Auth routes ---
      await api.register(authRoutes, { prefix: '/auth' });

      // --- Phase 2: Student routes ---
      await api.register(studentRoutes, { prefix: '/student' });

      // --- Phase 3: Progress tracking routes ---
      await api.register(progressRoutes, { prefix: '/progress' });

      // --- Phase 4: Teacher class management routes ---
      await api.register(teacherRoutes, { prefix: '/teacher' });

      // --- Phase 5: Admin user management routes ---
      await api.register(adminRoutes, { prefix: '/admin' });

      // --- Phase 7: Bulk student creation routes ---
      await api.register(bulkStudentRoutes, { prefix: '/bulk/students' });

      // --- Phase 7b: Bulk problem import routes ---
      await api.register(bulkProblemsRoutes, { prefix: '/bulk/problems' });

      // --- Code Window + Roadmap routes ---
      await api.register(teacherProblemsRoutes, { prefix: '/teacher/problems' });
      await api.register(studentProblemsRoutes, { prefix: '/student/problems' });
      await api.register(roadmapRoutes, { prefix: '/roadmap' });
      await api.register(sessionsRoutes, { prefix: '/sessions' });
      await api.register(pistonRoutes, { prefix: '/piston' });
      await api.register(metricsRoutes, { prefix: '/metrics' });

      // --- Ops: deploy preflight checks (DB + Redis + SMTP) ---
      api.get('/ops/preflight', async (request, reply) => {
        if (!env.PREFLIGHT_TOKEN) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Preflight endpoint is disabled',
          });
        }

        const tokenHeader = request.headers['x-preflight-token'];
        const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
        if (!token || token !== env.PREFLIGHT_TOKEN) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'Invalid preflight token',
          });
        }

        const report = await runPreflightChecks();
        return reply.code(report.status === 'ok' ? 200 : 503).send(report);
      });

      // --- Placeholder: AI endpoint ---
      api.post('/ai/ask', async (_request: FastifyRequest, reply: FastifyReply) => {
        void reply.status(501).send({
          error: 'NOT_IMPLEMENTED',
          message: 'AI service is not yet available.',
          data: 'AI service is currently under development. Please check back later.',
        });
      });
    },
    { prefix: '/api' }
  );

  // --- Root health (no prefix, for infra probes) ---
  app.get('/health', async (_request, reply) => {
    const { code, payload } = await getHealthResponse();
    return reply.code(code).send(payload);
  });

  // Compatibility route for legacy frontend clients calling /piston/execute directly.
  await app.register(pistonRoutes, { prefix: '/piston' });

  // --- 404 handler ---
  app.setNotFoundHandler(async (request, reply) => {
    void reply.status(404).send({
      error: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}
