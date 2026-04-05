// src/routes/teacher.routes.ts
// Teacher class management endpoints — Phase 4.
// Justification: implementation-roadmap.md Step 4.3
//
// All routes require authentication + TEACHER role.
// Routes are thin: validate → call service → send DTO.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireTeacher } from '../middleware/auth.middleware.js';
import { rateLimitPerUser } from '../middleware/rateLimit.middleware.js';
import * as teacherService from '../services/teacher.service.js';
import {
  classIdParamSchema,
  studentIdParamSchema,
  addStudentSchema,
  createTeacherClassSchema,
  studentListQuerySchema,
  searchStudentsQuerySchema,
} from '../types/teacher.types.js';
import { ValidationError } from '../utils/errors.js';

export default async function teacherRoutes(app: FastifyInstance) {
  // --- Prefix-level hooks: auth + teacher role on ALL routes ---
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireTeacher);
  app.addHook('onRequest', rateLimitPerUser({ max: 100, timeWindow: 60 })); // 100 requests per minute
  // GET /profile — teacher profile with university
  app.get('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await teacherService.getProfile(request.user!.userId);
    void reply.status(200).send(profile);
  });

  // GET /classes — list teacher's active classes
  app.get('/classes', async (request: FastifyRequest, reply: FastifyReply) => {
    const classes = await teacherService.getClasses(request.user!.userId);
    void reply.status(200).send({ classes });
  });

  // POST /classes — create class in teacher's own university
  app.post('/classes', async (request: FastifyRequest, reply: FastifyReply) => {
    const bodyResult = createTeacherClassSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const created = await teacherService.createClass(request.user!.userId, bodyResult.data);
    void reply.status(201).send(created);
  });

  // GET /classes/:classId — single class detail
  app.get('/classes/:classId', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const classData = await teacherService.getClass(paramResult.data.classId, request.user!.userId);
    void reply.status(200).send(classData);
  });

  // GET /classes/:classId/students — enrolled students (with pagination shape)
  app.get('/classes/:classId/students', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const queryResult = studentListQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters', queryResult.error.issues);
    }

    const result = await teacherService.getClassStudents(
      paramResult.data.classId,
      request.user!.userId,
      queryResult.data
    );
    void reply.status(200).send(result);
  });

  // GET /classes/:classId/search-students?q= — search students from teacher's university
  app.get(
    '/classes/:classId/search-students',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const paramResult = classIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw new ValidationError('Invalid class ID', paramResult.error.issues);
      }

      const queryResult = searchStudentsQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new ValidationError('Invalid query parameters', queryResult.error.issues);
      }

      const results = await teacherService.searchStudents(
        paramResult.data.classId,
        request.user!.userId,
        queryResult.data.q,
        queryResult.data.limit
      );
      void reply.status(200).send({ students: results });
    }
  );

  // POST /classes/:classId/students — add student to class
  app.post('/classes/:classId/students', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = classIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid class ID', paramResult.error.issues);
    }

    const bodyResult = addStudentSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new ValidationError('Validation failed', bodyResult.error.issues);
    }

    const response = await teacherService.addStudent(
      paramResult.data.classId,
      bodyResult.data.studentId,
      request.user!.userId
    );
    void reply.status(201).send(response);
  });

  // DELETE /classes/:classId/students/:studentId — remove student from class
  app.delete(
    '/classes/:classId/students/:studentId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { classId: string; studentId: string };

      const classResult = classIdParamSchema.safeParse({ classId: params.classId });
      if (!classResult.success) {
        throw new ValidationError('Invalid class ID', classResult.error.issues);
      }

      const studentResult = studentIdParamSchema.safeParse({ studentId: params.studentId });
      if (!studentResult.success) {
        throw new ValidationError('Invalid student ID', studentResult.error.issues);
      }

      const response = await teacherService.removeStudent(
        params.classId,
        params.studentId,
        request.user!.userId
      );
      void reply.status(200).send(response);
    }
  );

  // GET /students/:studentId/progress — view a student's progress (teacher-scoped)
  app.get('/students/:studentId/progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramResult = studentIdParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      throw new ValidationError('Invalid student ID', paramResult.error.issues);
    }

    const progress = await teacherService.getStudentProgress(
      paramResult.data.studentId,
      request.user!.userId
    );
    void reply.status(200).send(progress);
  });
}
