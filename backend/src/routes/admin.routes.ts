// src/routes/admin.routes.ts
// Admin user management endpoints — Phase 5.
// Admin class management endpoints — Phase 6.
// Justification: implementation-roadmap.md Step 5.5, Phase 6
//
// All routes require authentication + ADMIN/SUPER_ADMIN role.
// Routes are thin: validate → call service → send DTO.
// TODO: Add rate limiting via @fastify/rate-limit: 100 req/min for ADMIN (key: request.user.userId), 200 for SUPER_ADMIN

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { rateLimitPerUser } from '../middleware/rateLimit.middleware.js';
import * as adminService from '../services/admin.service.js';
import {
  userIdParamSchema,
  listUsersQuerySchema,
  updateUserSchema,
  changeRoleSchema,
} from '../types/admin.types.js';
import {
  classIdParamSchema,
  listClassesQuerySchema,
  createClassSchema,
  updateClassSchema,
  assignTeacherSchema,
} from '../types/class.types.js';
import { ValidationError } from '../utils/errors.js';

export default async function adminRoutes(app: FastifyInstance) {
  // --- Prefix-level hooks: auth + admin role on ALL routes ---
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireAdmin);  
  // Custom logic: 100 req/min for ADMIN, could use a specialized hook. 
  // For completeness, mapping SUPER_ADMIN check inside rate filter is complex, but standard rateLimitPerUser applies:
  app.addHook('onRequest', rateLimitPerUser({ max: 100, timeWindow: 60 }));
  // GET /users — list users with pagination and filters
  app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const queryResult = listUsersQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.issues);
    }

    const { page = 1, limit = 50, role, isActive, search } = queryResult.data;

    const result = await adminService.listUsers(
      page,
      limit,
      { role, isActive, search },
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(200).send(result);
  });

  // GET /users/:id — get user detail by ID
  app.get('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = userIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid user ID', paramResult.error.issues);
    }

    const user = await adminService.getUserById(
      paramResult.data.id,
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(200).send(user);
  });

  // PUT /users/:id — update user fields
  app.put('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = userIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid user ID', paramResult.error.issues);
    }

    const bodyResult = updateUserSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const updated = await adminService.updateUser(
      paramResult.data.id,
      bodyResult.data,
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(200).send(updated);
  });

  // PUT /users/:id/role — change user role
  app.put('/users/:id/role', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = userIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid user ID', paramResult.error.issues);
    }

    const bodyResult = changeRoleSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const updated = await adminService.changeRole(
      paramResult.data.id,
      bodyResult.data.role,
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(200).send(updated);
  });

  // DELETE /users/:id — soft delete user
  app.delete('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = userIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid user ID', paramResult.error.issues);
    }

    await adminService.deleteUser(
      paramResult.data.id,
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(204).send();
  });

  // GET /stats — get user statistics
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await adminService.getStats(
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );

    void reply.status(200).send(stats);
  });

  // ============================================
  // CLASS MANAGEMENT ENDPOINTS (Phase 6)
  // ============================================

  /**
   * Helper to get admin's universityId for scoped authorization.
   * TODO: Implement proper university-scoping when multi-tenancy is added.
   * Current implementation: SUPER_ADMIN has global access (returns first university ID).
   * For ADMIN role: fetch from user's email domain or profile.
   */
  async function getAdminUniversityId(_userId: string, role: string): Promise<string> {
    // SUPER_ADMIN has global access - return sentinel '*' to bypass scope checks
    if (role === 'SUPER_ADMIN') {
      return '*';
    }

    // For ADMIN: fetch university from email domain or default to first university
    // TODO: Add Admin profile table with universityId when multi-tenancy is implemented
    const prisma = (await import('../config/database.js')).prisma;
    const university = await prisma.university.findFirst();
    return university!.id;
  }

  // GET /stats/classes — get class statistics (MUST BE BEFORE /:id routes)
  app.get('/stats/classes', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await adminService.getClassStats(
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      request.id
    );

    void reply.status(200).send(stats);
  });

  // GET /classes — list classes with pagination and filters
  app.get('/classes', async (request: FastifyRequest, reply: FastifyReply) => {
    const queryResult = listClassesQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.issues);
    }

    const result = await adminService.listClasses(
      queryResult.data,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      request.id
    );

    void reply.status(200).send(result);
  });

  // GET /classes/:id — get class detail by ID
  app.get('/classes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const adminUniversityId = await getAdminUniversityId(request.user!.userId, request.user!.role);

    const classData = await adminService.getClassById(
      paramResult.data.id,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      adminUniversityId,
      request.id
    );

    void reply.status(200).send(classData);
  });

  // POST /classes — create a new class
  app.post('/classes', async (request: FastifyRequest, reply: FastifyReply) => {
    const bodyResult = createClassSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const adminUniversityId = await getAdminUniversityId(request.user!.userId, request.user!.role);

    const created = await adminService.createClass(
      bodyResult.data,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      adminUniversityId,
      request.id
    );

    void reply.status(201).send(created);
  });

  // PUT /classes/:id — update class fields
  app.put('/classes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const bodyResult = updateClassSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const adminUniversityId = await getAdminUniversityId(request.user!.userId, request.user!.role);

    const updated = await adminService.updateClass(
      paramResult.data.id,
      bodyResult.data,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      adminUniversityId,
      request.id
    );

    void reply.status(200).send(updated);
  });

  // PUT /classes/:id/teacher — assign teacher to class
  app.put('/classes/:id/teacher', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const bodyResult = assignTeacherSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const adminUniversityId = await getAdminUniversityId(request.user!.userId, request.user!.role);

    const updated = await adminService.assignTeacher(
      paramResult.data.id,
      bodyResult.data.teacherId,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      adminUniversityId,
      request.id
    );

    void reply.status(200).send(updated);
  });

  // DELETE /classes/:id — soft delete class
  app.delete('/classes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const adminUniversityId = await getAdminUniversityId(request.user!.userId, request.user!.role);

    const result = await adminService.softDeleteClass(
      paramResult.data.id,
      request.user!.userId,
      request.ip,
      request.headers['user-agent'],
      adminUniversityId,
      request.id
    );

    void reply.status(200).send(result);
  });

  // GET /audit-logs — paginated audit log viewer
  app.get('/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = 1, limit = 50, userId, eventType } = request.query as any;
    const result = await adminService.getAuditLogs(
      Number(page),
      Number(limit),
      { userId, eventType },
      request.user!.userId,
      request.ip,
      request.headers['user-agent']
    );
    void reply.status(200).send(result);
  });
}
