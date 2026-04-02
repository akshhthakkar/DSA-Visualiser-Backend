// src/__tests__/integration/progress.test.ts
// Phase 3 integration tests — student progress tracking.
// Uses app.inject() — no real HTTP server needed.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';
import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

describe('Progress Tracking Endpoints', () => {
  let app: FastifyInstance;
  let studentUserId: string;
  let studentToken: string;
  let teacherToken: string;
  let problemId: string;
  let problemId2: string;
  let problemId3: string;

  beforeEach(async () => {
    // Create university
    const uni = await prisma.university.create({
      data: { name: 'Test University', emailDomains: ['test.edu'] },
    });

    // Create student user + profile
    const studentUser = await prisma.user.create({
      data: {
        name: 'Alice Student',
        email: 'alice@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used.in.these.tests',
        role: 'STUDENT' as UserRole,
      },
    });
    studentUserId = studentUser.id;

    await prisma.student.create({
      data: {
        userId: studentUserId,
        registerNumber: '2024CS100',
        degree: 'Computer Science',
        batch: '2024',
        universityId: uni.id,
      },
    });

    studentToken = generateAccessToken({
      userId: studentUserId,
      email: studentUser.email,
      role: studentUser.role,
    });

    // Create teacher token (for 403 tests)
    const teacherUser = await prisma.user.create({
      data: {
        name: 'Dr. Teacher',
        email: 'teacher@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used.in.these.tests',
        role: 'TEACHER' as UserRole,
      },
    });
    teacherToken = generateAccessToken({
      userId: teacherUser.id,
      email: teacherUser.email,
      role: teacherUser.role,
    });

    // Create problems
    const p1 = await prisma.problem.create({
      data: {
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two numbers that add up to target',
        topic: 'Arrays',
        difficulty: 'EASY',
      },
    });
    problemId = p1.id;

    const p2 = await prisma.problem.create({
      data: {
        title: 'Merge Sort',
        slug: 'merge-sort',
        description: 'Implement merge sort',
        topic: 'Sorting',
        difficulty: 'MEDIUM',
      },
    });
    problemId2 = p2.id;

    const p3 = await prisma.problem.create({
      data: {
        title: 'Graph DFS',
        slug: 'graph-dfs',
        description: 'Depth-first search',
        topic: 'Graphs',
        difficulty: 'HARD',
      },
    });
    problemId3 = p3.id;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // POST /api/progress/record
  // ============================================
  describe('POST /api/progress/record', () => {
    it('should record an attempt and return progress', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'IN_PROGRESS',
          timeSpentSeconds: 120,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress).toBeDefined();
      expect(body.progress.problemId).toBe(problemId);
      expect(body.progress.status).toBe('IN_PROGRESS');
      expect(body.progress.attempts).toBe(1);
      expect(body.progress.timeSpentSeconds).toBe(120);
      expect(body.progress.solvedAt).toBeNull();
      expect(body.progress.lastAttemptedAt).toBeDefined();
    });

    it('should increment attempts and accumulate time on repeated calls', async () => {
      app = await buildApp();

      // First attempt
      await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'ATTEMPTED',
          timeSpentSeconds: 60,
        },
      });

      // Second attempt
      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'IN_PROGRESS',
          timeSpentSeconds: 120,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress.attempts).toBe(2);
      expect(body.progress.timeSpentSeconds).toBe(180); // 60 + 120
    });

    it('should set solvedAt on first solve and not overwrite it', async () => {
      app = await buildApp();

      // First solve
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'SOLVED',
          timeSpentSeconds: 300,
        },
      });

      expect(res1.statusCode).toBe(200);
      const body1 = res1.json();
      expect(body1.progress.status).toBe('SOLVED');
      expect(body1.progress.solvedAt).toBeDefined();
      const firstSolvedAt = body1.progress.solvedAt;

      // Second solve — solvedAt should NOT change
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'SOLVED',
          timeSpentSeconds: 100,
        },
      });

      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.progress.solvedAt).toBe(firstSolvedAt);
      expect(body2.progress.attempts).toBe(2);
      expect(body2.progress.timeSpentSeconds).toBe(400); // 300 + 100
    });

    it('should store variantUsed and codeSubmission', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId,
          status: 'SOLVED',
          timeSpentSeconds: 200,
          variantUsed: 'two-pointer',
          codeSubmission: 'function twoSum(nums, target) { return [0, 1]; }',
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify stored in DB
      const row = await prisma.studentProgress.findUnique({
        where: { studentId_problemId: { studentId: studentUserId, problemId } },
      });
      expect(row).toBeDefined();
      expect(row!.variantUsed).toBe('two-pointer');
      expect(row!.codeSubmission).toBe('function twoSum(nums, target) { return [0, 1]; }');
    });

    it('should return 404 for non-existent problem', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId: '00000000-0000-0000-0000-000000000000',
          status: 'SOLVED',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid body', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          problemId: 'not-a-uuid',
          status: 'INVALID_STATUS',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        payload: { problemId, status: 'SOLVED' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for teacher role', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { problemId, status: 'SOLVED' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // GET /api/progress/:problemId
  // ============================================
  describe('GET /api/progress/:problemId', () => {
    it('should return progress for a tracked problem', async () => {
      app = await buildApp();

      // Record an attempt first
      await app.inject({
        method: 'POST',
        url: '/api/progress/record',
        headers: { authorization: `Bearer ${studentToken}` },
        payload: { problemId, status: 'SOLVED', timeSpentSeconds: 250 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/progress/${problemId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.problemId).toBe(problemId);
      expect(body.status).toBe('SOLVED');
      expect(body.attempts).toBe(1);
      expect(body.timeSpentSeconds).toBe(250);
    });

    it('should return NOT_STARTED default for untracked problem', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/progress/${problemId}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('NOT_STARTED');
      expect(body.attempts).toBe(0);
      expect(body.timeSpentSeconds).toBe(0);
      expect(body.solvedAt).toBeNull();
      expect(body.lastAttemptedAt).toBeNull();
    });
  });

  // ============================================
  // GET /api/progress
  // ============================================
  describe('GET /api/progress', () => {
    beforeEach(async () => {
      // Seed progress for filtering tests
      await prisma.studentProgress.createMany({
        data: [
          {
            studentId: studentUserId,
            problemId,
            status: 'SOLVED',
            attempts: 2,
            timeSpentSeconds: 300,
            solvedAt: new Date(),
            lastAttemptedAt: new Date(),
          },
          {
            studentId: studentUserId,
            problemId: problemId2,
            status: 'IN_PROGRESS',
            attempts: 1,
            timeSpentSeconds: 60,
            lastAttemptedAt: new Date(),
          },
          {
            studentId: studentUserId,
            problemId: problemId3,
            status: 'ATTEMPTED',
            attempts: 3,
            timeSpentSeconds: 450,
            lastAttemptedAt: new Date(),
          },
        ],
      });
    });

    it('should return all progress', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/progress',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress).toHaveLength(3);
    });

    it('should filter by status', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/progress?status=SOLVED',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress).toHaveLength(1);
      expect(body.progress[0].status).toBe('SOLVED');
      expect(body.progress[0].problemTitle).toBe('Two Sum');
    });

    it('should filter by difficulty', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/progress?difficulty=HARD',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress).toHaveLength(1);
      expect(body.progress[0].difficulty).toBe('HARD');
      expect(body.progress[0].problemTitle).toBe('Graph DFS');
    });

    it('should filter by topic', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/progress?topic=Sorting',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.progress).toHaveLength(1);
      expect(body.progress[0].topic).toBe('Sorting');
    });
  });
});
