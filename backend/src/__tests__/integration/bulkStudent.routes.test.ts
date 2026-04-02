import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getTestServer } from '../helpers/testServer.js';
import { getMockAuthToken } from '../helpers/mockAuth.js';
import { createTestUser, createTestUniversity } from '../helpers/fixtures.js';
import * as emailService from '../../services/email.service.js';
import type { FastifyInstance } from 'fastify';

// Mock email service
vi.mock('../../services/email.service.js', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
  sendBulkEmails: vi.fn().mockResolvedValue(true),
}));

describe('Bulk Student Routes Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let teacherToken: string;
  let universityId: string;

  beforeAll(async () => {
    app = await getTestServer();
  });

  beforeEach(async () => {
    const university = await createTestUniversity({
      emailDomains: ['university.edu'],
    });
    universityId = university.id;

    // Create test accounts
    const teacherUser = await createTestUser({
      email: `teacher-bulk-${Date.now()}@test.edu`,
      role: 'TEACHER',
    });

    // SUPER_ADMIN covers the admin requirement for these routes
    const superAdminUser = await createTestUser({
      email: `super-bulk-${Date.now()}@test.edu`,
      role: 'SUPER_ADMIN',
    });

    adminToken = getMockAuthToken(superAdminUser.id, superAdminUser.email, superAdminUser.role);
    teacherToken = getMockAuthToken(teacherUser.id, teacherUser.email, teacherUser.role);
  });

  describe('POST /api/bulk/students/bulk-create', () => {
    it('should allow ADMIN (SUPER_ADMIN) to bulk create students via JSON', async () => {
      const payload = {
        universityId,
        students: [
          {
            name: 'Bulk Student 1',
            email: `bulk1-${Date.now()}@university.edu`,
            registerNumber: `REG-B1-${Date.now()}`,
            degree: 'CS',
            batch: '2024',
          },
          {
            name: 'Bulk Student 2',
            email: `bulk2-${Date.now()}@university.edu`,
            registerNumber: `REG-B2-${Date.now()}`,
            degree: 'CS',
            batch: '2024',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${adminToken}` },
        payload,
      });
      if (response.statusCode !== 201) {
        console.error('FAILED PAYLOAD:', response.payload);
      }
      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.summary.successful).toBe(2);
      expect(data.summary.failed).toBe(0);

      expect(emailService.sendBulkEmails).toHaveBeenCalledTimes(1);
    });

    it('should reject TEACHER from bulk creating students', async () => {
      const payload = {
        universityId,
        students: [
          {
            name: 'Bulk Student 3',
            email: `bulk3-${Date.now()}@university.edu`,
            registerNumber: `REG-B3-${Date.now()}`,
            degree: 'CS',
            batch: '2024',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/bulk/students/bulk-create',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/bulk/students/history', () => {
    it('should allow SUPER_ADMIN to view import history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/history',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('imports');
      expect(data).toHaveProperty('pagination');
      expect(Array.isArray(data.imports)).toBe(true);
    });
  });

  describe('GET /api/bulk/students/template', () => {
    it('should return a CSV template', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bulk/students/template',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.payload).toContain('name,email,registerNumber,degree,batch,password');
    });
  });
});
