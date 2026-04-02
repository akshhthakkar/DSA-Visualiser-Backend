import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getTestServer } from '../helpers/testServer.js';
import { getMockAuthToken } from '../helpers/mockAuth.js';
import { createTestUser, createTestUniversity } from '../helpers/fixtures.js';
import type { FastifyInstance } from 'fastify';

describe('RBAC Middleware Integration', () => {
  let app: FastifyInstance;

  let studentToken: string;
  let teacherToken: string;
  let adminToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await getTestServer();
  });

  beforeEach(async () => {
    await createTestUniversity();

    // Create users with different roles
    const student = await createTestUser({
      email: `student-rbac-${Date.now()}@test.edu`,
      role: 'STUDENT',
    });
    const teacher = await createTestUser({
      email: `teacher-rbac-${Date.now()}@test.edu`,
      role: 'TEACHER',
    });
    const admin = await createTestUser({
      email: `admin-rbac-${Date.now()}@test.edu`,
      role: 'ADMIN',
    });
    const superAdmin = await createTestUser({
      email: `superadmin-rbac-${Date.now()}@test.edu`,
      role: 'SUPER_ADMIN',
    });

    studentToken = getMockAuthToken(student.id, student.email, student.role);
    teacherToken = getMockAuthToken(teacher.id, teacher.email, teacher.role);
    adminToken = getMockAuthToken(admin.id, admin.email, admin.role);
    superAdminToken = getMockAuthToken(superAdmin.id, superAdmin.email, superAdmin.role);
  });

  // STUDENT Role Tests
  describe('STUDENT Role', () => {
    it('should access student routes (/api/progress)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/progress',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      // Assuming GET /api/progress requires auth and works for students
      expect(response.statusCode).toBe(200);
    });

    it('should be blocked from teacher routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes', // We assume prefix is /api/teacher (or similar, test might 404 but we check for 403)
        headers: { authorization: `Bearer ${studentToken}` },
      });
      // The role check should happen before 404 if the route has the hook on the prefix, or at least 403/401
      expect(response.statusCode).toBe(403);
    });

    it('should be blocked from admin routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // TEACHER Role Tests
  describe('TEACHER Role', () => {
    it('should access teacher routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      // 200 means it got passed RBAC
      expect(response.statusCode).toBe(200);
    });

    it('should be blocked from admin routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // ADMIN Role Tests
  describe('ADMIN Role', () => {
    it('should access admin routes (/api/admin/users)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should access bulk-create routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/history',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  // SUPER_ADMIN Role Tests
  describe('SUPER_ADMIN Role', () => {
    it('should access admin routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
