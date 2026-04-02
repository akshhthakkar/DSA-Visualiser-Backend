// src/__tests__/integration/bulkStudent.test.ts
// Bulk student creation integration tests — security hardened.
// Uses app.inject() — no real HTTP server needed.
//
// Coverage:
//   - JSON bulk-create: happy path, duplicates, validation
//   - University scope enforcement (admin vs SUPER_ADMIN)
//   - Email domain validation
//   - mustResetPassword flag
//   - CSV template download
//   - Auth/role guards

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';
import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

describe('Bulk Student Creation Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let superAdminToken: string;
  let studentToken: string;
  let universityId: string;

  beforeEach(async () => {
    // Create university with email domain restriction
    const university = await prisma.university.create({
      data: {
        name: 'Test University',
        emailDomains: ['test.edu'],
        maxStudents: 1000,
        isActive: true,
      },
    });
    universityId = university.id;

    // Create admin user with teacher profile (scoped to university)
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
    await prisma.teacher.create({
      data: {
        userId: adminUser.id,
        universityId: university.id,
        department: 'Computer Science',
      },
    });
    adminToken = generateAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create SUPER_ADMIN (no profile — uses body universityId)
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
    superAdminToken = generateAccessToken({
      userId: superAdminUser.id,
      email: superAdminUser.email,
      role: superAdminUser.role,
    });

    // Create student user (for auth guard testing)
    const studentUser = await prisma.user.create({
      data: {
        name: 'Student User',
        email: 'student@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'STUDENT' as UserRole,
        isActive: true,
        emailVerified: false,
      },
    });
    studentToken = generateAccessToken({
      userId: studentUser.id,
      email: studentUser.email,
      role: studentUser.role,
    });
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // HAPPY PATH
  // ============================================
  describe('POST /api/bulk/students/bulk-create', () => {
    it('should create students with admin token (universityId from profile)', async () => {
      app = await buildApp();

      // Admin does NOT pass universityId — derived from teacher profile
      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Alice Test',
              email: 'alice@test.edu',
              registerNumber: '2024CS001',
              degree: 'Computer Science',
              batch: '2024',
            },
            {
              name: 'Bob Test',
              email: 'bob@test.edu',
              registerNumber: '2024CS002',
              degree: 'Computer Science',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.summary.total).toBe(2);
      expect(body.summary.successful).toBe(2);
      expect(body.summary.failed).toBe(0);
      expect(body.mustResetPassword).toBe(true);
      // Auto-generated passwords should be present
      expect(body.success[0].password).toBeDefined();
      expect(body.success[0].password.length).toBeGreaterThanOrEqual(8);
    });

    it('should set mustResetPassword on created users', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Reset Test',
              email: 'reset@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);

      // Verify DB flag via raw SQL (Prisma 7 adapter cache workaround)
      const result = await prisma.$queryRaw<{ must_reset_password: boolean }[]>`
        SELECT must_reset_password FROM users WHERE email = 'reset@test.edu'
      `;
      expect(result[0]?.must_reset_password).toBe(true);
    });

    // ============================================
    // UNIVERSITY SCOPE ENFORCEMENT
    // ============================================
    it('SUPER_ADMIN can specify universityId in body', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          universityId,
          students: [
            {
              name: 'SA Student',
              email: 'sa@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().summary.successful).toBe(1);
    });

    it('ADMIN without profile and no universityId → rejected', async () => {
      // Create admin with no teacher/student profile
      const orphanAdmin = await prisma.user.create({
        data: {
          name: 'Orphan Admin',
          email: 'orphan@test.edu',
          passwordHash: '$2b$12$placeholder.hash.not.used',
          role: 'ADMIN' as UserRole,
          isActive: true,
          emailVerified: true,
        },
      });
      const orphanToken = generateAccessToken({
        userId: orphanAdmin.id,
        email: orphanAdmin.email,
        role: orphanAdmin.role,
      });

      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${orphanToken}` },
        payload: {
          universityId, // ADMIN body universityId is ignored
          students: [
            {
              name: 'Test',
              email: 'test@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
    });

    // ============================================
    // EMAIL DOMAIN VALIDATION
    // ============================================
    it('should reject students with wrong email domain', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Valid Student',
              email: 'valid@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
            {
              name: 'Invalid Domain',
              email: 'invalid@gmail.com',
              registerNumber: '2024CS002',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.summary.successful).toBe(1);
      expect(body.summary.failed).toBe(1);
      expect(body.failed[0].error).toContain('Email domain not allowed');
    });

    // ============================================
    // DUPLICATE HANDLING
    // ============================================
    it('should handle existing email duplicates gracefully', async () => {
      app = await buildApp();

      // Create existing user
      const existingUser = await prisma.user.create({
        data: {
          name: 'Existing Student',
          email: 'existing@test.edu',
          passwordHash: '$2b$12$placeholder.hash.not.used',
          role: 'STUDENT',
          isActive: true,
        },
      });
      await prisma.student.create({
        data: {
          userId: existingUser.id,
          registerNumber: '2024CS999',
          degree: 'CS',
          batch: '2024',
          universityId,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'New Student',
              email: 'new@test.edu',
              registerNumber: '2024CS010',
              degree: 'Computer Science',
              batch: '2024',
            },
            {
              name: 'Duplicate Student',
              email: 'existing@test.edu',
              registerNumber: '2024CS011',
              degree: 'Computer Science',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.summary.successful).toBe(1);
      expect(body.summary.failed).toBe(1);
      expect(body.failed[0].error).toContain('already exists');
    });

    it('should reject duplicate emails within the batch', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Student A',
              email: 'same@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
            {
              name: 'Student B',
              email: 'same@test.edu',
              registerNumber: '2024CS002',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.message).toContain('Duplicate emails');
    });

    // ============================================
    // INVALID UNIVERSITY
    // ============================================
    it('SUPER_ADMIN with invalid universityId → 404', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          universityId: '00000000-0000-0000-0000-000000000000',
          students: [
            {
              name: 'Test Student',
              email: 'test@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
    });

    // ============================================
    // CUSTOM PASSWORDS
    // ============================================
    it('should accept custom passwords when provided', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Pwd Student',
              email: 'pwd@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
              password: 'MyCustomPwd123!',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success[0].password).toBe('MyCustomPwd123!');
    });

    // ============================================
    // VALIDATION
    // ============================================
    it('should reject empty students array', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    // ============================================
    // AUTH GUARDS
    // ============================================
    it('should reject request without auth token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        payload: {
          students: [
            {
              name: 'Test',
              email: 'test@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject student role access', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          students: [
            {
              name: 'Test',
              email: 'test@test.edu',
              registerNumber: '2024CS001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // CSV TEMPLATE
  // ============================================
  describe('GET /api/bulk/students/template', () => {
    it('should return CSV template with correct headers', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/template',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('student_import_template.csv');

      const csv = res.body;
      const firstLine = csv.split('\n')[0]!;
      expect(firstLine).toContain('name');
      expect(firstLine).toContain('email');
      expect(firstLine).toContain('registerNumber');
      expect(firstLine).toContain('degree');
      expect(firstLine).toContain('batch');
    });
  });

  // ============================================
  // IMPORT HISTORY
  // ============================================
  describe('GET /api/bulk/students/history', () => {
    it('should record an entry in BulkImport after successful creation', async () => {
      app = await buildApp();

      // 1. Create students
      await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'History Test',
              email: 'history@test.edu',
              registerNumber: 'HIST001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      // 2. Check history
      const res = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/history',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.imports.length).toBeGreaterThanOrEqual(1);
      const record = body.imports[0];
      expect(record.fileName).toBe('json-upload');
      expect(record.successful).toBe(1);
      expect(record.status).toBe('completed');
      expect(record.admin.name).toBe('Admin User');
    });

    it('should record failed rows in BulkImport history', async () => {
      app = await buildApp();

      // Create students with one failure (wrong domain)
      await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          students: [
            {
              name: 'Fail Test',
              email: 'fail@gmail.com', // Wrong domain
              registerNumber: 'FAIL001',
              degree: 'CS',
              batch: '2024',
            },
          ],
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/history',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const body = res.json();
      const record = body.imports[0];
      expect(record.status).toBe('completed_with_errors');
      expect(record.failed).toBe(1);
      expect(record.failedRows.length).toBe(1);
      expect(record.failedRows[0].error).toContain('Email domain not allowed');
    });
  });

  // ============================================
  // VALIDATION ONLY
  // ============================================
  describe('POST /api/bulk/students/validate-csv', () => {
    it('should return validation result for multipart CSV without creating users', async () => {
      app = await buildApp();

      // Fastify multipart mock using Boundary
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const csv = 'name,email,registerNumber,degree,batch\nVal Test,val@test.edu,VAL001,CS,2024';
      const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.csv"\r\nContent-Type: text/csv\r\n\r\n${csv}\r\n--${boundary}--\r\n`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/validate-csv',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.summary.valid).toBe(1);
      expect(body.valid[0].email).toBe('val@test.edu');

      // Verify NO user was created
      const user = await prisma.user.findUnique({ where: { email: 'val@test.edu' } });
      expect(user).toBeNull();
    });
  });
});
