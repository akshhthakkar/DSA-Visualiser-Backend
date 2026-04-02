// src/__tests__/integration/admin.test.ts
// Phase 5 integration tests — admin user management.
// Uses app.inject() — no real HTTP server needed.
//
// Critical test coverage:
//   - SUPER_ADMIN protection (cannot update/delete/change role)
//   - Self-action prevention (admin cannot modify own account)
//   - Authorization (admin/super_admin only, students/teachers blocked)
//   - Pagination and filters (role, isActive, search)
//   - Audit log creation for all actions

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';
import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

describe('Admin User Management Endpoints', () => {
  let app: FastifyInstance;
  let adminUserId: string;
  let adminToken: string;
  let superAdminUserId: string;
  let superAdminToken: string;
  let studentUserId: string;
  let studentToken: string;

  beforeEach(async () => {
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'ADMIN' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateAccessToken({
      userId: adminUserId,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create SUPER_ADMIN user
    const superAdminUser = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'SUPER_ADMIN' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    superAdminUserId = superAdminUser.id;
    superAdminToken = generateAccessToken({
      userId: superAdminUserId,
      email: superAdminUser.email,
      role: superAdminUser.role,
    });

    // Create student user (for modification tests)
    const studentUser = await prisma.user.create({
      data: {
        name: 'Test Student',
        email: 'student@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'STUDENT' as UserRole,
        isActive: true,
        emailVerified: false,
      },
    });
    studentUserId = studentUser.id;
    studentToken = generateAccessToken({
      userId: studentUserId,
      email: studentUser.email,
      role: studentUser.role,
    });
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // GET /api/admin/users — List Users
  // ============================================
  describe('GET /api/admin/users', () => {
    it('should return paginated user list', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBeGreaterThan(0);
      expect(body.pagination.totalPages).toBeGreaterThan(0);
    });

    it('should filter by role', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users?role=STUDENT',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users.every((u: any) => u.role === 'STUDENT')).toBe(true);
    });

    it('should filter by isActive', async () => {
      app = await buildApp();

      // Create inactive user
      await prisma.user.create({
        data: {
          name: 'Inactive User',
          email: 'inactive@test.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'STUDENT' as UserRole,
          isActive: false,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users?isActive=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users.every((u: any) => u.isActive === true)).toBe(true);
    });

    it('should search by name or email', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users?search=Test Student',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users.length).toBeGreaterThan(0);
      expect(
        body.users.some((u: any) => u.name.includes('Test Student') || u.email.includes('student'))
      ).toBe(true);
    });

    it('should reject unauthorized access (no token)', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject student access', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should allow SUPER_ADMIN access', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ============================================
  // GET /api/admin/users/:id — Get User Detail
  // ============================================
  describe('GET /api/admin/users/:id', () => {
    it('should return user detail', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.userId).toBe(studentUserId);
      expect(body.name).toBe('Test Student');
      expect(body.email).toBe('student@test.edu');
      expect(body.role).toBe('STUDENT');
    });

    it('should return 404 for non-existent user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for soft-deleted user', async () => {
      app = await buildApp();

      // Soft delete student
      await prisma.user.update({
        where: { id: studentUserId },
        data: { deletedAt: new Date() },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ============================================
  // PUT /api/admin/users/:id — Update User
  // ============================================
  describe('PUT /api/admin/users/:id', () => {
    it('should update user fields', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Student Name',
          isActive: false,
          emailVerified: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe('Updated Student Name');
      expect(body.isActive).toBe(false);
      expect(body.emailVerified).toBe(true);
    });

    it('should reject self-modification', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New Name' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('Cannot modify your own account');
    });

    it('should reject updating SUPER_ADMIN user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${superAdminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Hacked Super Admin' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Cannot modify SUPER_ADMIN');
    });

    it('should return 404 for non-existent user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/users/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Test' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ============================================
  // PUT /api/admin/users/:id/role — Change Role
  // ============================================
  describe('PUT /api/admin/users/:id/role', () => {
    it('should change user role', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${studentUserId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'TEACHER' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.role).toBe('TEACHER');
    });

    it('should reject SUPER_ADMIN role assignment', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${studentUserId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'SUPER_ADMIN' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('Cannot assign SUPER_ADMIN');
    });

    it('should reject changing SUPER_ADMIN user role', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${superAdminUserId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'STUDENT' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Cannot modify SUPER_ADMIN');
    });

    it('should reject self role change', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${adminUserId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'STUDENT' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('Cannot modify your own account');
    });

    it('should log old and new role in audit metadata', async () => {
      app = await buildApp();

      await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${studentUserId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'ADMIN' },
      });

      // Check audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: adminUserId,
          eventType: 'ADMIN_CHANGE_ROLE',
          resourceId: studentUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.metadata).toBeDefined();
      const metadata = auditLog?.metadata as any;
      expect(metadata.oldRole).toBe('STUDENT');
      expect(metadata.newRole).toBe('ADMIN');
    });
  });

  // ============================================
  // DELETE /api/admin/users/:id — Soft Delete
  // ============================================
  describe('DELETE /api/admin/users/:id', () => {
    it('should soft delete user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify soft delete in database
      const user = await prisma.user.findUnique({
        where: { id: studentUserId },
      });
      expect(user?.deletedAt).toBeDefined();
      expect(user?.isActive).toBe(false);
    });

    it('should exclude deleted user from list endpoint', async () => {
      app = await buildApp();

      // Delete student
      await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // List users
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.users.find((u: any) => u.userId === studentUserId)).toBeUndefined();
    });

    it('should reject deleting SUPER_ADMIN user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${superAdminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().message).toContain('Cannot modify SUPER_ADMIN');
    });

    it('should reject self-deletion', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${adminUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('Cannot modify your own account');
    });

    it('should return 404 for non-existent user', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/users/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ============================================
  // GET /api/admin/stats — User Statistics
  // ============================================
  describe('GET /api/admin/stats', () => {
    it('should return user statistics', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThan(0);
      expect(body.active).toBeGreaterThan(0);
      expect(body.inactive).toBeGreaterThanOrEqual(0);
      expect(body.byRole).toBeDefined();
      expect(body.byRole.STUDENT).toBeGreaterThan(0);
      expect(body.byRole.ADMIN).toBeGreaterThan(0);
      expect(body.byRole.SUPER_ADMIN).toBeGreaterThan(0);
    });

    it('should exclude soft-deleted users from stats', async () => {
      app = await buildApp();

      // Get initial stats
      const before = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeBody = before.json();
      const beforeTotal = beforeBody.total;

      // Soft delete student
      await prisma.user.update({
        where: { id: studentUserId },
        data: { deletedAt: new Date(), isActive: false },
      });

      // Get stats again
      const after = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const afterBody = after.json();

      expect(afterBody.total).toBe(beforeTotal - 1);
    });
  });

  // ============================================
  // Audit Log Verification
  // ============================================
  describe('Audit Logs', () => {
    it('should create audit log for list users', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const log = await prisma.auditLog.findFirst({
        where: {
          userId: adminUserId,
          eventType: 'ADMIN_LIST_USERS',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });

    it('should create audit log for view user', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const log = await prisma.auditLog.findFirst({
        where: {
          userId: adminUserId,
          eventType: 'ADMIN_VIEW_USER',
          resourceId: studentUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });

    it('should create audit log for update user', async () => {
      app = await buildApp();

      await app.inject({
        method: 'PUT',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Updated' },
      });

      const log = await prisma.auditLog.findFirst({
        where: {
          userId: adminUserId,
          eventType: 'ADMIN_UPDATE_USER',
          resourceId: studentUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });

    it('should create audit log for delete user', async () => {
      app = await buildApp();

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/users/${studentUserId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const log = await prisma.auditLog.findFirst({
        where: {
          userId: adminUserId,
          eventType: 'ADMIN_DELETE_USER',
          resourceId: studentUserId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });
  });
});

// ============================================
// Admin Class Management Tests - Phase 6
// ============================================
describe('Admin Class Management Endpoints', () => {
  let app: FastifyInstance;
  let adminUserId: string;
  let adminToken: string;
  let superAdminUserId: string;
  let _superAdminToken: string;
  let studentUserId: string;
  let studentToken: string;

  let srmistId: string;
  let annaId: string;
  let teacherId: string;
  let annaTeacherId: string;
  let activeClassId: string;
  let inactiveClassId: string;
  let deletedClassId: string;

  beforeEach(async () => {
    // Create admin users (same pattern as user management tests)
    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@srmist.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'ADMIN' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    adminUserId = adminUser.id;
    adminToken = generateAccessToken({
      userId: adminUserId,
      email: adminUser.email,
      role: adminUser.role,
    });

    const superAdminUser = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'SUPER_ADMIN' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    superAdminUserId = superAdminUser.id;
    _superAdminToken = generateAccessToken({
      userId: superAdminUserId,
      email: superAdminUser.email,
      role: superAdminUser.role,
    });

    const studentUser = await prisma.user.create({
      data: {
        name: 'Test Student',
        email: 'student@srmist.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'STUDENT' as UserRole,
        isActive: true,
        emailVerified: false,
      },
    });
    studentUserId = studentUser.id;
    studentToken = generateAccessToken({
      userId: studentUserId,
      email: studentUser.email,
      role: studentUser.role,
    });

    // Create test universities
    const srmist = await prisma.university.create({
      data: {
        name: 'SRMIST',
        emailDomains: ['@srmist.edu'],
        isActive: true,
      },
    });
    srmistId = srmist.id;

    const anna = await prisma.university.create({
      data: {
        name: 'Anna University',
        emailDomains: ['@annauniv.edu'],
        isActive: true,
      },
    });
    annaId = anna.id;

    // Create student profile
    await prisma.student.create({
      data: {
        userId: studentUserId,
        universityId: srmistId,
        registerNumber: 'RA2111003010001',
        degree: 'BACHELORS',
        batch: '2024',
      },
    });

    // Create test teachers
    const teacher = await prisma.user.create({
      data: {
        name: 'SRMIST Teacher',
        email: 'teacher@srmist.edu',
        passwordHash: '$2b$12$placeholder',
        role: 'TEACHER' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    teacherId = teacher.id;
    await prisma.teacher.create({
      data: {
        userId: teacherId,
        universityId: srmistId,
      },
    });

    const annaTeacher = await prisma.user.create({
      data: {
        name: 'Anna Teacher',
        email: 'teacher@annauniv.edu',
        passwordHash: '$2b$12$placeholder',
        role: 'TEACHER' as UserRole,
        isActive: true,
        emailVerified: true,
      },
    });
    annaTeacherId = annaTeacher.id;
    await prisma.teacher.create({
      data: {
        userId: annaTeacherId,
        universityId: annaId,
      },
    });

    // Create test classes
    const activeClass = await prisma.class.create({
      data: {
        code: 'CSE-2024-A',
        name: 'Computer Science 2024 Section A',
        degree: 'BACHELORS',
        batch: '2024',
        semester: '1',
        universityId: srmistId,
        primaryTeacherId: teacherId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-05-31'),
        isActive: true,
      },
    });
    activeClassId = activeClass.id;

    const inactiveClass = await prisma.class.create({
      data: {
        code: 'IT-2024-A',
        name: 'Information Technology 2024',
        degree: 'BACHELORS',
        batch: '2024',
        semester: '1',
        universityId: srmistId,
        primaryTeacherId: teacherId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-05-31'),
        isActive: false,
      },
    });
    inactiveClassId = inactiveClass.id;

    const deletedClass = await prisma.class.create({
      data: {
        code: 'CSE-2022-OLD',
        name: 'Computer Science 2022',
        degree: 'BACHELORS',
        batch: '2022',
        semester: '1',
        universityId: srmistId,
        primaryTeacherId: teacherId,
        startDate: new Date('2022-01-01'),
        endDate: new Date('2022-05-31'),
        isActive: false,
        deletedAt: new Date(),
      },
    });
    deletedClassId = deletedClass.id;

    // Create Anna class for cross-university tests
    await prisma.class.create({
      data: {
        code: 'DS-2024-W1',
        name: 'Data Science 2024 Weekend',
        degree: 'MASTERS',
        batch: '2024',
        semester: '1',
        universityId: annaId,
        primaryTeacherId: annaTeacherId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
      },
    });

    // Add student enrollment for stats tests
    await prisma.classStudent.create({
      data: {
        classId: activeClassId,
        studentId: studentUserId,
      },
    });
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // GET /api/admin/stats/classes — Class Stats
  // ============================================
  describe('GET /api/admin/stats/classes', () => {
    it('should return class statistics with correct counts', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.total).toBeGreaterThanOrEqual(1); // At least active + inactive (excludes deleted)
      expect(data.active).toBeGreaterThanOrEqual(1);
      expect(data.inactive).toBeGreaterThanOrEqual(0);
      expect(data.byDegree).toBeDefined();
      expect(data.lastComputedAt).toBeDefined();
      expect(new Date(data.lastComputedAt as string)).toBeInstanceOf(Date);
    });

    it('should exclude soft-deleted classes from stats', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const data = res.json();
      // Should not count the deletedClassId
      const allClasses = await prisma.class.count({
        where: { deletedAt: null },
      });
      expect(data.total).toBe(allClasses);
    });

    it('should require authentication', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats/classes',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ============================================
  // GET /api/admin/classes — List Classes
  // ============================================
  describe('GET /api/admin/classes', () => {
    it('should return paginated class list', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.classes).toBeInstanceOf(Array);
      expect(data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: false,
      });
    });

    it('should filter by degree', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?degree=BACHELORS',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      data.classes.forEach((cls: { degree: string }) => {
        expect(cls.degree).toBe('BACHELORS');
      });
    });

    it('should filter by isActive', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?isActive=true',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      data.classes.forEach((cls: { isActive: boolean }) => {
        expect(cls.isActive).toBe(true);
      });
    });

    it('should filter by batch', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?batch=2024',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      data.classes.forEach((cls: { batch: string }) => {
        expect(cls.batch).toBe('2024');
      });
    });

    it('should search by name or code', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?search=Computer',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.classes.length).toBeGreaterThan(0);
      data.classes.forEach((cls: { name: string; code: string }) => {
        expect(
          cls.name.toLowerCase().includes('computer') || cls.code.toLowerCase().includes('computer')
        ).toBe(true);
      });
    });

    it('should exclude soft-deleted classes', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      const deletedFound = data.classes.some((cls: { id: string }) => cls.id === deletedClassId);
      expect(deletedFound).toBe(false);
    });

    it('should block STUDENT access', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should calculate hasNext and hasPrev correctly', async () => {
      app = await buildApp();

      // Create additional classes to test pagination
      await prisma.class.createMany({
        data: Array.from({ length: 15 }, (_, i) => ({
          code: `TEST-${i}`,
          name: `Test Class ${i}`,
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-05-31'),
          isActive: true,
        })),
      });

      // Page 1
      const res1 = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?page=1&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data1 = res1.json();
      expect(data1.pagination.hasNext).toBe(true);
      expect(data1.pagination.hasPrev).toBe(false);

      // Middle page
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/admin/classes?page=2&limit=5',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const data2 = res2.json();
      expect(data2.pagination.hasNext).toBe(true);
      expect(data2.pagination.hasPrev).toBe(true);
    });
  });

  // ============================================
  // GET /api/admin/classes/:id — Get Class Detail
  // ============================================
  describe('GET /api/admin/classes/:id', () => {
    it('should return class detail with enrollments', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.id).toBe(activeClassId);
      expect(data.code).toBe('CSE-2024-A');
      expect(data.enrollments).toBeInstanceOf(Array);
      expect(data.enrollments.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 for non-existent class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/classes/123e4567-e89b-12d3-a456-426614174000',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for soft-deleted class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${deletedClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should block access to class from different university', async () => {
      app = await buildApp();

      // Get Anna class ID
      const annaClass = await prisma.class.findFirst({
        where: { universityId: annaId },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${annaClass!.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // POST /api/admin/classes — Create Class
  // ============================================
  describe('POST /api/admin/classes', () => {
    it('should create a new class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'NEW-2024-A',
          name: 'New Class 2024',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '2',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: '2024-06-01T00:00:00Z',
          endDate: '2024-10-31T23:59:59Z',
          isActive: true,
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.code).toBe('NEW-2024-A');
      expect(data.name).toBe('New Class 2024');
    });

    it('should return 404 for invalid university', async () => {
      app = await buildApp();

      // Use SUPER_ADMIN to bypass university scope check
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${_superAdminToken}` },
        payload: {
          code: 'NEW-2024-B',
          name: 'Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: '123e4567-e89b-12d3-a456-426614174002',
          primaryTeacherId: teacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for invalid teacher', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'NEW-2024-C',
          name: 'Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: '123e4567-e89b-12d3-a456-426614174001', // Valid UUID but doesn't exist
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject teacher from different university', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'NEW-2024-D',
          name: 'Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: annaTeacherId, // Anna teacher for SRMIST class
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should validate date range', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'NEW-2024-E',
          name: 'Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          startDate: '2024-05-31T00:00:00Z',
          endDate: '2024-01-01T23:59:59Z', // End before start
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject duplicate class code in same university', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'CSE-2024-A', // Already exists in SRMIST
          name: 'Duplicate',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should allow same code in different university', async () => {
      app = await buildApp();

      // Use SUPER_ADMIN who can create in any university
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${_superAdminToken}` },
        payload: {
          code: 'CSE-2024-A', // Same as SRMIST but for Anna
          name: 'Anna CSE',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: annaId,
          primaryTeacherId: annaTeacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should block admin from creating class in different university', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'ANNA-TEST',
          name: 'Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: annaId, // Admin is from SRMIST
          primaryTeacherId: annaTeacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // PUT /api/admin/classes/:id — Update Class
  // ============================================
  describe('PUT /api/admin/classes/:id', () => {
    it('should update class name and dates', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Updated Class Name',
          startDate: '2024-02-01T00:00:00Z',
          endDate: '2024-06-30T23:59:59Z',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('Updated Class Name');
    });

    it('should return 404 for non-existent class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/classes/123e4567-e89b-12d3-a456-426614174003',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Test' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for soft-deleted class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${deletedClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Test' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should reject attempt to change universityId (immutable)', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          universityId: annaId, // Attempt to change immutable field
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR'); // Zod strict mode rejects unknown fields
    });

    it('should reject attempt to change code (immutable)', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'CSE-2024-B', // Attempt to change immutable field
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR'); // Zod strict mode rejects unknown fields
    });

    it('should validate date range on update', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          startDate: '2024-06-01T00:00:00Z',
          endDate: '2024-01-01T23:59:59Z', // End before start
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ============================================
  // PUT /api/admin/classes/:id/teacher — Assign Teacher
  // ============================================
  describe('PUT /api/admin/classes/:id/teacher', () => {
    it('should assign teacher to class', async () => {
      app = await buildApp();

      // Create new teacher
      const newTeacher = await prisma.user.create({
        data: {
          name: 'New Teacher',
          email: 'newteacher@srmist.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'TEACHER' as UserRole,
          isActive: true,
          emailVerified: true,
        },
      });
      await prisma.teacher.create({
        data: {
          userId: newTeacher.id,
          universityId: srmistId,
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}/teacher`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          teacherId: newTeacher.id,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.primaryTeacher.userId).toBe(newTeacher.id);
    });

    it('should reject teacher from different university', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}/teacher`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          teacherId: annaTeacherId, // Anna teacher for SRMIST class
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should return 404 for non-existent class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: '/api/admin/classes/123e4567-e89b-12d3-a456-426614174004/teacher',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teacherId: teacherId },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for non-existent teacher', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}/teacher`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teacherId: '123e4567-e89b-12d3-a456-426614174005' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should block access to class from different university', async () => {
      app = await buildApp();

      const annaClass = await prisma.class.findFirst({
        where: { universityId: annaId },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${annaClass!.id}/teacher`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teacherId: annaTeacherId },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should create audit log with before/after metadata', async () => {
      app = await buildApp();

      const newTeacher = await prisma.user.create({
        data: {
          name: 'Audit Teacher',
          email: 'auditteacher@srmist.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'TEACHER' as UserRole,
          isActive: true,
          emailVerified: true,
        },
      });
      await prisma.teacher.create({
        data: {
          userId: newTeacher.id,
          universityId: srmistId,
        },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}/teacher`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teacherId: newTeacher.id },
      });

      expect(res.statusCode).toBe(200);

      // Give audit log time to write (non-blocking)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_ASSIGN_TEACHER',
          resourceId: activeClassId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'ASSIGN_TEACHER',
        before: expect.objectContaining({ primaryTeacherId: expect.any(String) }),
        after: expect.objectContaining({ primaryTeacherId: newTeacher.id }),
      });
    });
  });

  // ============================================
  // DELETE /api/admin/classes/:id — Soft Delete Class
  // ============================================
  describe('DELETE /api/admin/classes/:id', () => {
    it('should soft delete class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);

      // Verify soft delete
      const deleted = await prisma.class.findUnique({
        where: { id: inactiveClassId },
      });
      expect(deleted!.deletedAt).not.toBeNull();
    });

    it('should exclude soft-deleted class from list', async () => {
      app = await buildApp();

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const listRes = await app.inject({
        method: 'GET',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const data = listRes.json();
      const found = data.classes.some((cls: { id: string }) => cls.id === inactiveClassId);
      expect(found).toBe(false);
    });

    it('should exclude soft-deleted class from getById', async () => {
      app = await buildApp();

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(getRes.statusCode).toBe(404);
    });

    it('should return 409 for already deleted class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${deletedClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should return 404 for non-existent class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/classes/123e4567-e89b-12d3-a456-426614174006',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should block access to class from different university', async () => {
      app = await buildApp();

      const annaClass = await prisma.class.findFirst({
        where: { universityId: annaId },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${annaClass!.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // Concurrency Edge Cases
  // ============================================
  describe('Concurrency Edge Cases', () => {
    it('should reject duplicate class creation in parallel (race condition)', async () => {
      app = await buildApp();

      const payload = {
        code: 'RACE-2024',
        name: 'Race Condition Test',
        degree: 'BACHELORS',
        batch: '2024',
        semester: '1',
        universityId: srmistId,
        primaryTeacherId: teacherId,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-05-31T23:59:59Z',
      };

      const results = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/admin/classes',
          headers: { authorization: `Bearer ${adminToken}` },
          payload,
        }),
        app.inject({
          method: 'POST',
          url: '/api/admin/classes',
          headers: { authorization: `Bearer ${adminToken}` },
          payload,
        }),
      ]);

      const statusCodes = results.map((r) => r.statusCode);
      expect(statusCodes).toContain(201); // One succeeds
      expect(statusCodes).toContain(409); // One fails with duplicate
    });

    it('should handle sequential double delete gracefully', async () => {
      app = await buildApp();

      const res1 = await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res1.statusCode).toBe(200);

      const res2 = await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res2.statusCode).toBe(409); // Already deleted
      expect(res2.json().code).toBe('CONFLICT');
    });

    it('should prevent update after soft delete', async () => {
      app = await buildApp();

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const res = await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should prevent creating class with code of soft-deleted class (partial unique index)', async () => {
      app = await buildApp();

      // deletedClassId has code 'CSE-2022-OLD' and is soft-deleted
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'CSE-2022-OLD', // Same code as deleted class
          name: 'Reuse Code Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      // Partial unique index enforces uniqueness even for soft-deleted
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should handle parallel teacher assignments', async () => {
      app = await buildApp();

      const teacher2 = await prisma.user.create({
        data: {
          name: 'Concurrent Teacher',
          email: 'concurrent@srmist.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'TEACHER' as UserRole,
          isActive: true,
          emailVerified: true,
        },
      });
      await prisma.teacher.create({
        data: {
          userId: teacher2.id,
          universityId: srmistId,
        },
      });

      const results = await Promise.all([
        app.inject({
          method: 'PUT',
          url: `/api/admin/classes/${activeClassId}/teacher`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { teacherId: teacherId },
        }),
        app.inject({
          method: 'PUT',
          url: `/api/admin/classes/${activeClassId}/teacher`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { teacherId: teacher2.id },
        }),
      ]);

      // Both should succeed (last write wins)
      expect(results[0].statusCode).toBe(200);
      expect(results[1].statusCode).toBe(200);

      // Verify final state
      const finalClass = await prisma.class.findUnique({
        where: { id: activeClassId },
      });
      expect([teacherId, teacher2.id]).toContain(finalClass!.primaryTeacherId);
    });
  });

  // ============================================
  // Audit Log Verification
  // ============================================
  describe('Audit Logs', () => {
    it('should create audit log for LIST action', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_LIST_CLASSES',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'LIST',
      });
    });

    it('should create audit log for VIEW action', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_VIEW_CLASS',
          resourceId: activeClassId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });

    it('should create audit log for CREATE action with after state', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'AUDIT-CREATE',
          name: 'Audit Create Test',
          degree: 'BACHELORS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      const classId = res.json().id;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_CREATE_CLASS',
          resourceId: classId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'CREATE',
        after: expect.objectContaining({
          code: 'AUDIT-CREATE',
        }),
      });
    });

    it('should create audit log for UPDATE action with before/after', async () => {
      app = await buildApp();

      await app.inject({
        method: 'PUT',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Audit Update Test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_UPDATE_CLASS',
          resourceId: activeClassId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'UPDATE',
        before: expect.any(Object),
        after: expect.objectContaining({
          name: 'Audit Update Test',
        }),
      });
    });

    it('should create audit log for DELETE action', async () => {
      app = await buildApp();

      await app.inject({
        method: 'DELETE',
        url: `/api/admin/classes/${inactiveClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_DELETE_CLASS',
          resourceId: inactiveClassId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'SOFT_DELETE',
        resourceId: inactiveClassId,
      });
    });

    it('should create audit log for STATS action', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: '/api/admin/stats/classes',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_VIEW_CLASS_STATS',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
    });

    it('should include requestId in audit metadata', async () => {
      app = await buildApp();

      await app.inject({
        method: 'GET',
        url: `/api/admin/classes/${activeClassId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_VIEW_CLASS',
          resourceId: activeClassId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toHaveProperty('requestId');
      const metadata = log!.metadata as Record<string, unknown>;
      expect(typeof metadata.requestId).toBe('string');
    });

    it('should create structured audit metadata with context', async () => {
      app = await buildApp();

      await app.inject({
        method: 'POST',
        url: '/api/admin/classes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: 'AUDIT-CTX',
          name: 'Context Test',
          degree: 'MASTERS',
          batch: '2024',
          semester: '1',
          universityId: srmistId,
          primaryTeacherId: teacherId,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-05-31T23:59:59Z',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const log = await prisma.auditLog.findFirst({
        where: {
          eventType: 'ADMIN_CREATE_CLASS',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(log).toBeDefined();
      expect(log!.metadata).toMatchObject({
        action: 'CREATE',
        context: expect.objectContaining({
          adminUniversityId: srmistId,
        }),
        after: expect.objectContaining({
          code: 'AUDIT-CTX',
        }),
        requestId: expect.any(String),
      });
    });
  });
});
