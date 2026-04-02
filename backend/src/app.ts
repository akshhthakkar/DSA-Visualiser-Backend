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
import metricsRoutes from './routes/metrics.routes.js';

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
  // Accepts the primary production URL + any Vercel preview deployment URLs.
  const allowedOrigins: (string | RegExp)[] = [env.FRONTEND_URL];

  // Allow all Vercel preview deployments for this project (e.g. dsavisualization-*.vercel.app)
  allowedOrigins.push(/^https:\/\/dsavisualization[a-zA-Z0-9-]*\.vercel\.app$/);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return cb(null, true);
      const allowed = allowedOrigins.some((o) =>
        typeof o === 'string' ? o === origin : o.test(origin)
      );
      if (allowed) return cb(null, true);
      cb(new Error(`CORS: Origin '${origin}' not allowed`), false);
    },
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

  // --- API prefix: all routes under /api ---
  await app.register(
    async (api) => {
      // --- Phase 0: Health check ---
      api.get('/health', async () => {
        let redisStatus: 'connected' | 'disconnected' = 'disconnected';
        try {
          const pong = await redis.ping();
          if (pong === 'PONG') redisStatus = 'connected';
        } catch {
          // Redis unreachable — report disconnected
        }

        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: env.NODE_ENV,
          redis: redisStatus,
        };
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
      await api.register(metricsRoutes, { prefix: '/metrics' });

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
  app.get('/health', async () => {
    let redisStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') redisStatus = 'connected';
    } catch {
      // Redis unreachable — report disconnected
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      redis: redisStatus,
    };
  });

  // --- 404 handler ---
  app.setNotFoundHandler(async (request, reply) => {
    void reply.status(404).send({
      error: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return app;
}
