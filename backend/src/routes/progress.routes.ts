// src/routes/progress.routes.ts
// Student progress tracking endpoints — Phase 3.
// Justification: implementation-roadmap.md Step 3.4
//
// All routes require authentication + STUDENT role.
// Routes are thin: validate → call service → send DTO.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireStudent } from '../middleware/auth.middleware.js';
import * as progressService from '../services/progress.service.js';
import { recordAttemptSchema, getProgressQuerySchema } from '../types/progress.types.js';
import { ValidationError } from '../utils/errors.js';

export default async function progressRoutes(app: FastifyInstance) {
  // --- Prefix-level hooks: auth + student role on ALL routes ---
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireStudent);

  // POST /record — record an attempt (solve/attempt/in-progress)
  app.post('/record', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = recordAttemptSchema.safeParse(request.body);
    if (!result.success) {
      throw new ValidationError('Validation failed', result.error.issues);
    }

    const response = await progressService.recordAttempt(request.user!.userId, result.data);

    void reply.status(200).send(response);
  });

  // GET /:problemId — progress for a specific problem
  app.get('/:problemId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { problemId } = request.params as { problemId: string };

    const progress = await progressService.getProgressForProblem(request.user!.userId, problemId);

    void reply.status(200).send(progress);
  });

  // GET / — all progress (with optional status/difficulty/topic filters)
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = getProgressQuerySchema.safeParse(request.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.issues);
    }

    const allProgress = await progressService.getAllProgress(request.user!.userId, result.data);

    void reply.status(200).send({ progress: allProgress });
  });
}
