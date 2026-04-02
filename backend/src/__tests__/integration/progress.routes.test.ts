import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getTestServer } from '../helpers/testServer.js';
import { createTestStudent, createTestUser, createTestUniversity } from '../helpers/fixtures.js';
import { getMockAuthToken } from '../helpers/mockAuth.js';
import { prisma } from '../../config/database.js';
import type { FastifyInstance } from 'fastify';

describe('Progress Routes Integration', () => {
  let app: FastifyInstance;
  let studentUser: any;
  let studentToken: string;
  let adminToken: string;
  let problemId: string;

  beforeAll(async () => {
    app = await getTestServer();
  });

  beforeEach(async () => {
    // Shared setup
    const uni = await createTestUniversity({ emailDomains: ['test.edu'] });
    const student = await createTestStudent({ email: 'prog-integ@test.edu' }, uni.id);
    studentUser = student.user;

    const admin = await createTestUser({ email: 'admin-prog@test.edu', role: 'ADMIN' });

    // Generate tokens
    studentToken = getMockAuthToken(studentUser.id, studentUser.email, studentUser.role);
    adminToken = getMockAuthToken(admin.id, admin.email, admin.role);

    // Create a problem to test against
    const problem = await prisma.problem.create({
      data: {
        slug: `integ-prob-${Date.now()}`,
        title: 'Integration Problem',
        difficulty: 'MEDIUM',
        description: 'Test integration',
        category: 'Trees',
        topic: 'Trees',
      },
    });
    problemId = problem.id;
  });

  describe('POST /api/progress/record', () => {
    it('should successfully record progress for a STUDENT', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
        payload: {
          problemId,
          status: 'ATTEMPTED',
          timeSpentSeconds: 300,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.progress).toBeDefined();
      expect(data.progress.status).toBe('ATTEMPTED');
      expect(data.progress.timeSpentSeconds).toBe(300);
      expect(data.progress.attempts).toBe(1);
    });

    it('should reject progress recording for an ADMIN (requires STUDENT)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: {
          authorization: `Bearer ${adminToken}`, // Using admin token
        },
        payload: { problemId, status: 'ATTEMPTED' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 400 for invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: {
          authorization: `Bearer ${studentToken}`,
        },
        // Missing status
        payload: { problemId },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/progress/:problemId', () => {
    it('should return default progress if none recorded', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/progress/${problemId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('NOT_STARTED');
      expect(data.attempts).toBe(0);
    });

    it('should return updated progress if recorded previously', async () => {
      // First record
      await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { problemId, status: 'SOLVED', timeSpentSeconds: 500 },
      });

      // Then fetch
      const response = await app.inject({
        method: 'GET',
        url: `/api/progress/${problemId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.status).toBe('SOLVED');
      expect(data.attempts).toBe(1);
    });
  });

  describe('GET /api/progress', () => {
    it('should return a list of all progress items for student', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { problemId, status: 'SOLVED' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/progress',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.progress).toBeInstanceOf(Array);
      expect(data.progress.length).toBe(1);
      expect(data.progress[0].problemId).toBe(problemId);
      expect(data.progress[0].status).toBe('SOLVED');
    });

    it('should filter progress based on query string', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { problemId, status: 'SOLVED' },
      });

      // Filter by NOT_STARTED which shouldn't return our SOLVED one
      const response = await app.inject({
        method: 'GET',
        url: '/api/progress?status=NOT_STARTED',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.progress.length).toBe(0);
    });
  });
});
