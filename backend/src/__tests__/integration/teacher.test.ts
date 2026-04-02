// src/__tests__/integration/teacher.test.ts
// Phase 4 integration tests — teacher class management.
// Uses app.inject() — no real HTTP server needed.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';
import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

describe('Teacher Class Management Endpoints', () => {
  let app: FastifyInstance;
  let teacherUserId: string;
  let teacherToken: string;
  let studentUserId: string;
  let studentToken: string;
  let classId: string;
  let universityId: string;

  beforeEach(async () => {
    // Create university
    const uni = await prisma.university.create({
      data: { name: 'Test University', emailDomains: ['test.edu'] },
    });
    universityId = uni.id;

    // Create teacher user + profile
    const teacherUser = await prisma.user.create({
      data: {
        name: 'Dr. Teacher',
        email: 'teacher@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
        role: 'TEACHER' as UserRole,
      },
    });
    teacherUserId = teacherUser.id;

    await prisma.teacher.create({
      data: {
        userId: teacherUserId,
        universityId,
        department: 'Computer Science',
      },
    });

    teacherToken = generateAccessToken({
      userId: teacherUserId,
      email: teacherUser.email,
      role: teacherUser.role,
    });

    // Create student user + profile
    const studentUser = await prisma.user.create({
      data: {
        name: 'Alice Student',
        email: 'alice@test.edu',
        passwordHash: '$2b$12$placeholder.hash.not.used',
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
        universityId,
      },
    });

    studentToken = generateAccessToken({
      userId: studentUserId,
      email: studentUser.email,
      role: studentUser.role,
    });

    // Create class owned by teacher
    const cls = await prisma.class.create({
      data: {
        name: 'Data Structures',
        code: 'CS301',
        degree: 'Computer Science',
        batch: '2024',
        universityId,
        primaryTeacherId: teacherUserId,
      },
    });
    classId = cls.id;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // GET /api/teacher/profile
  // ============================================
  describe('GET /api/teacher/profile', () => {
    it('should return teacher profile', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/teacher/profile',
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.userId).toBe(teacherUserId);
      expect(body.name).toBe('Dr. Teacher');
      expect(body.email).toBe('teacher@test.edu');
      expect(body.department).toBe('Computer Science');
      expect(body.university.name).toBe('Test University');
    });
  });

  // ============================================
  // GET /api/teacher/classes
  // ============================================
  describe('GET /api/teacher/classes', () => {
    it('should return teacher classes', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes',
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.classes).toHaveLength(1);
      expect(body.classes[0].name).toBe('Data Structures');
      expect(body.classes[0].code).toBe('CS301');
      expect(body.classes[0].studentCount).toBe(0);
    });

    it('should exclude soft-deleted classes', async () => {
      app = await buildApp();

      // Soft-delete the class
      await prisma.class.update({
        where: { id: classId },
        data: { deletedAt: new Date() },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes',
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().classes).toHaveLength(0);
    });
  });

  // ============================================
  // GET /api/teacher/classes/:classId
  // ============================================
  describe('GET /api/teacher/classes/:classId', () => {
    it('should return class detail', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/classes/${classId}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(classId);
      expect(body.name).toBe('Data Structures');
      expect(body.maxStudents).toBe(60);
    });

    it("should return 404 for another teacher's class (no existence leak)", async () => {
      app = await buildApp();

      // Create another teacher
      const otherTeacher = await prisma.user.create({
        data: {
          name: 'Dr. Other',
          email: 'other@test.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'TEACHER' as UserRole,
        },
      });
      await prisma.teacher.create({
        data: {
          userId: otherTeacher.id,
          universityId,
          department: 'Math',
        },
      });
      const otherToken = generateAccessToken({
        userId: otherTeacher.id,
        email: otherTeacher.email,
        role: otherTeacher.role,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/classes/${classId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      // Returns 404, not 403 — no existence leak
      expect(res.statusCode).toBe(404);
    });
  });

  // ============================================
  // GET /api/teacher/classes/:classId/students
  // ============================================
  describe('GET /api/teacher/classes/:classId/students', () => {
    beforeEach(async () => {
      // Enroll student
      await prisma.classStudent.create({
        data: { classId, studentId: studentUserId },
      });
    });

    it('should return enrolled students', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.students).toHaveLength(1);
      expect(body.students[0].name).toBe('Alice Student');
      expect(body.students[0].email).toBe('alice@test.edu');
      expect(body.nextCursor).toBeNull(); // only 1 student, below limit
    });

    it('should respect limit parameter and return nextCursor', async () => {
      app = await buildApp();

      // Add a second student
      const student2 = await prisma.user.create({
        data: {
          name: 'Bob Student',
          email: 'bob@test.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'STUDENT' as UserRole,
        },
      });
      await prisma.student.create({
        data: {
          userId: student2.id,
          registerNumber: '2024CS200',
          degree: 'Computer Science',
          batch: '2024',
          universityId,
        },
      });
      await prisma.classStudent.create({
        data: { classId, studentId: student2.id },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/classes/${classId}/students?limit=1`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.students).toHaveLength(1);
      expect(body.nextCursor).toBeDefined();
      expect(body.nextCursor).not.toBeNull();
    });
  });

  // ============================================
  // POST /api/teacher/classes/:classId/students
  // ============================================
  describe('POST /api/teacher/classes/:classId/students', () => {
    it('should add student to class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/api/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { studentId: studentUserId },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().message).toBe('Student added successfully');

      // Verify in DB
      const enrollment = await prisma.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId: studentUserId } },
      });
      expect(enrollment).toBeDefined();
    });

    it('should reject duplicate enrollment with 409', async () => {
      app = await buildApp();

      // Enroll first
      await prisma.classStudent.create({
        data: { classId, studentId: studentUserId },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { studentId: studentUserId },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should reject invalid body with 400', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: `/api/teacher/classes/${classId}/students`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { studentId: 'not-a-uuid' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });
  });

  // ============================================
  // DELETE /api/teacher/classes/:classId/students/:studentId
  // ============================================
  describe('DELETE /api/teacher/classes/:classId/students/:studentId', () => {
    beforeEach(async () => {
      await prisma.classStudent.create({
        data: { classId, studentId: studentUserId },
      });
    });

    it('should remove student from class', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/teacher/classes/${classId}/students/${studentUserId}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Student removed successfully');

      // Verify removed from DB
      const enrollment = await prisma.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId: studentUserId } },
      });
      expect(enrollment).toBeNull();
    });
  });

  // ============================================
  // GET /api/teacher/students/:studentId/progress
  // ============================================
  describe('GET /api/teacher/students/:studentId/progress', () => {
    beforeEach(async () => {
      // Enroll student in teacher's class
      await prisma.classStudent.create({
        data: { classId, studentId: studentUserId },
      });

      // Create problem and progress
      const problem = await prisma.problem.create({
        data: {
          title: 'Two Sum',
          slug: 'two-sum',
          description: 'Find two numbers that add up to target',
          topic: 'Arrays',
          difficulty: 'EASY',
        },
      });

      await prisma.studentProgress.create({
        data: {
          studentId: studentUserId,
          problemId: problem.id,
          status: 'SOLVED',
          attempts: 2,
          timeSpentSeconds: 600,
          solvedAt: new Date(),
          lastAttemptedAt: new Date(),
        },
      });
    });

    it('should return student progress for enrolled student', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/students/${studentUserId}/progress`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.student.email).toBe('alice@test.edu');
      expect(body.summary.solved).toBe(1);
      expect(body.summary.totalProblems).toBeGreaterThanOrEqual(1);
      expect(body.progress).toHaveLength(1);
      expect(body.progress[0].problemTitle).toBe('Two Sum');
    });

    it('should reject access to non-enrolled student with 403', async () => {
      app = await buildApp();

      // Create another student not in teacher's class
      const otherStudent = await prisma.user.create({
        data: {
          name: 'Charlie Other',
          email: 'charlie@test.edu',
          passwordHash: '$2b$12$placeholder',
          role: 'STUDENT' as UserRole,
        },
      });
      await prisma.student.create({
        data: {
          userId: otherStudent.id,
          registerNumber: '2024CS999',
          degree: 'Computer Science',
          batch: '2024',
          universityId,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/teacher/students/${otherStudent.id}/progress`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ============================================
  // AUTH GUARDS
  // ============================================
  describe('Auth guards', () => {
    it('should return 401 without token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 with student token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'GET',
        url: '/api/teacher/classes',
        headers: { authorization: `Bearer ${studentToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
