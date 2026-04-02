// src/routes/student.routes.ts
// Student dashboard endpoints — Phase 2.
// Justification: implementation-roadmap.md Step 2.4
//
// All routes require authentication + STUDENT role.
// Routes are thin: call service → send DTO. No transformation.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireStudent } from '../middleware/auth.middleware.js';
import { rateLimitPerUser } from '../middleware/rateLimit.middleware.js';
import * as studentService from '../services/student.service.js';

export default async function studentRoutes(app: FastifyInstance) {
  // --- Prefix-level hooks: auth + student role on ALL routes ---
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireStudent);
  app.addHook('onRequest', rateLimitPerUser({ max: 100, timeWindow: 60 })); // 100 requests per minute

  // GET /dashboard — full student dashboard (profile, progress, recent activity)
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const dashboard = await studentService.getDashboard(request.user!.userId);
    void reply.status(200).send(dashboard);
  });

  // GET /progress — progress summary only
  app.get('/progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const progress = await studentService.getProgress(request.user!.userId);
    void reply.status(200).send(progress);
  });
}
