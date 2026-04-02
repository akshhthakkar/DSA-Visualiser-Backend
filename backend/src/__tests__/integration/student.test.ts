// src/__tests__/integration/student.test.ts
// Phase 2 integration tests — student dashboard, progress, auth/me.
// Uses app.inject() — no real HTTP server needed.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';
import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

describe('Student Dashboard Endpoints', () => {
  let app: FastifyInstance;
  let universityId: string;
  let studentUserId: string;
  let studentToken: string;
  let teacherToken: string;
  let problemId: string;

  beforeEach(async () => {
    // Create university
    const uni = await prisma.university.create({
      data: { name: 'Test University', emailDomains: ['test.edu'] },
    });
    universityId = uni.id;

    // Create student user + profile
    const studentUser = await prisma.user.create({
      data: {
        name: 'Jane Student',
        email: 'jane@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used.in.these.tests',
        role: 'STUDENT' as UserRole,
      },
    });
    studentUserId = studentUser.id;

    await prisma.student.create({
      data: {
        userId: studentUserId,
        registerNumber: '2024CS001',
        degree: 'Computer Science',
        batch: '2024',
        universityId,
      },
    });

    studentToken = generateAccessToken({
      userId: studentUserId,
      email: studentUser.email,
      role: studentUser.role,
    });

    // Create teacher user
    const teacherUser = await prisma.user.create({
      data: {
        name: 'Dr. Smith',
        email: 'smith@test.edu',
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
    const problem = await prisma.problem.create({
      data: {
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two numbers that add up to target',
        topic: 'Arrays',
        difficulty: 'EASY',
      },
    });
    problemId = problem.id;

    await prisma.problem.create({
      data: {
        title: 'Binary Search',
        slug: 'binary-search',
        description: 'Implement binary search',
        topic: 'Searching',
        difficulty: 'MEDIUM',
      },
    });

    await prisma.problem.create({
      data: {
        title: 'Merge Sort',
        slug: 'merge-sort',
        description: 'Implement merge sort',
        topic: 'Sorting',
        difficulty: 'HARD',
      },
    });

    // Create student progress — one SOLVED, one NOT_STARTED
    await prisma.studentProgress.create({
      data: {
        studentId: studentUserId,
        problemId,
        status: 'SOLVED',
        attempts: 3,
        solvedAt: new Date(),
        lastAttemptedAt: new Date(),
      },
    });

    // NOT_STARTED row — should be filtered from recent activity
    await prisma.studentProgress.create({
      data: {
        studentId: studentUserId,
        problemId: (await prisma.problem.findFirst({ where: { slug: 'binary-search' } }))!.id,
        status: 'NOT_STARTED',
        attempts: 0,
      },
    });
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // GET /api/student/dashboard
  // ============================================
  describe('GET /api/student/dashboard', () => {
    it('should return student dashboard with profile, progress, and recent activity', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/student/dashboard',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Student profile
      expect(body.student).toBeDefined();
      expect(body.student.name).toBe('Jane Student');
      expect(body.student.email).toBe('jane@test.edu');
      expect(body.student.registerNumber).toBe('2024CS001');
      expect(body.student.degree).toBe('Computer Science');
      expect(body.student.university.name).toBe('Test University');

      // Progress — totalProblems from problems table, not progress rows
      expect(body.progress).toBeDefined();
      expect(body.progress.totalProblems).toBe(3); // 3 problems created
      expect(body.progress.solved).toBe(1);
      expect(body.progress.notStarted).toBe(2); // 3 total - 1 solved = 2

      // Recent activity — should NOT include NOT_STARTED
      expect(body.recentActivity).toBeDefined();
      expect(body.recentActivity).toHaveLength(1); // only the SOLVED entry
      expect(body.recentActivity[0].problemTitle).toBe('Two Sum');
      expect(body.recentActivity[0].status).toBe('SOLVED');
      expect(body.recentActivity[0].attempts).toBe(3);
    });

    it('should return 401 without token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/student/dashboard',
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 for teacher role', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/student/dashboard',
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  // ============================================
  // GET /api/student/progress
  // ============================================
  describe('GET /api/student/progress', () => {
    it('should return progress summary', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/student/progress',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.summary).toBeDefined();
      expect(body.summary.totalProblems).toBe(3);
      expect(body.summary.solved).toBe(1);
    });

    it('should return 401 without token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/student/progress',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ============================================
  // GET /api/auth/me
  // ============================================
  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(studentUserId);
      expect(body.user.email).toBe('jane@test.edu');
      expect(body.user.name).toBe('Jane Student');
      expect(body.user.role).toBe('STUDENT');
      // Must NOT contain passwordHash
      expect(body.user.passwordHash).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should work for teacher role too', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.role).toBe('TEACHER');
    });
  });
});
