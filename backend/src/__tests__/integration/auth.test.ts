// src/__tests__/integration/auth.test.ts
// Phase 1 integration tests — signup, login, logout, refresh.
// Uses app.inject() — no real HTTP server needed.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../setup.js';

// Test university ID — recreated before each test
let universityId: string;

// Reusable test data
const studentSignup = () => ({
  name: 'Test Student',
  email: `student-${Date.now()}@test.edu`,
  password: 'StrongPass1!',
  role: 'STUDENT' as const,
  universityId,
  registerNumber: `REG${Date.now()}`,
  degree: 'B.Tech CSE',
  batch: '2024',
});

const teacherSignup = () => ({
  name: 'Test Teacher',
  email: `teacher-${Date.now()}@test.edu`,
  password: 'StrongPass1!',
  role: 'TEACHER' as const,
  universityId,
  department: 'Computer Science',
});

describe('Auth Endpoints', () => {
  let app: FastifyInstance;

  // Recreate university before each test (setup.ts truncates all tables)
  beforeEach(async () => {
    const uni = await prisma.university.create({
      data: { name: 'Test University', emailDomains: ['test.edu'] },
    });
    universityId = uni.id;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ============================================
  // SIGNUP
  // ============================================
  describe('POST /api/auth/signup', () => {
    it('should create a student user and return 201 with user + accessToken', async () => {
      app = await buildApp();
      const payload = studentSignup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(payload.email);
      expect(body.user.role).toBe('STUDENT');
      expect(body.accessToken).toBeDefined();
      expect(body.user.passwordHash).toBeUndefined();

      // Verify refresh cookie set
      const cookies = res.cookies as Array<{ name: string; httpOnly?: boolean; path?: string }>;
      const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie!.httpOnly).toBe(true);
      expect(refreshCookie!.path).toBe('/api/auth');
    });

    it('should create a teacher user and return 201', async () => {
      app = await buildApp();
      const payload = teacherSignup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.user.role).toBe('TEACHER');
    });

    it('should reject duplicate email with 409', async () => {
      app = await buildApp();
      const payload = studentSignup();

      // First signup
      await app.inject({ method: 'POST', url: '/api/auth/signup', payload });

      // Duplicate
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CONFLICT');
    });

    it('should reject weak password with 400', async () => {
      app = await buildApp();
      const payload = { ...studentSignup(), password: 'weak' };

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should reject missing student fields with 400', async () => {
      app = await buildApp();
      const payload = {
        name: 'Missing Fields',
        email: `missing-${Date.now()}@test.edu`,
        password: 'StrongPass1!',
        role: 'STUDENT',
        universityId,
        // Missing registerNumber, degree, batch
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      expect(res.statusCode).toBe(400);
    });

    it('should create a session record in the database', async () => {
      app = await buildApp();
      const payload = studentSignup();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      const body = res.json();
      const sessions = await prisma.session.findMany({
        where: { userId: body.user.id },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.refreshToken).toBeDefined();
    });
  });

  // ============================================
  // LOGIN
  // ============================================
  describe('POST /api/auth/login', () => {
    const email = `login-test-${Date.now()}@test.edu`;
    const password = 'StrongPass1!';

    // Create user before login tests
    async function createTestUser(appInstance: FastifyInstance) {
      await appInstance.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          name: 'Login Test User',
          email,
          password,
          role: 'STUDENT',
          universityId,
          registerNumber: `LREG${Date.now()}`,
          degree: 'B.Tech CSE',
          batch: '2024',
        },
      });
    }

    it('should return 200 with valid credentials + set refresh cookie', async () => {
      app = await buildApp();
      await createTestUser(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user).toBeDefined();
      expect(body.accessToken).toBeDefined();
      expect(body.user.passwordHash).toBeUndefined();

      const cookies = res.cookies as Array<{ name: string }>;
      const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
      expect(refreshCookie).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      app = await buildApp();
      await createTestUser(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'WrongPassword1!' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent email', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nobody@test.edu', password: 'Whatever1!' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Invalid credentials');
    });

    it('should increment loginCount after login', async () => {
      app = await buildApp();
      await createTestUser(app);

      // Login twice
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });

      const user = await prisma.user.findFirst({ where: { email } });
      expect(user!.loginCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // LOGOUT
  // ============================================
  describe('POST /api/auth/logout', () => {
    it('should delete the session and clear the cookie', async () => {
      app = await buildApp();
      const payload = studentSignup();

      // Signup to get a session
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      const cookies = signupRes.cookies as Array<{ name: string; value: string }>;
      const refreshCookie = cookies.find((c) => c.name === 'refreshToken');

      // Logout
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        cookies: { refreshToken: refreshCookie!.value },
      });

      expect(logoutRes.statusCode).toBe(200);
      expect(logoutRes.json().message).toBe('Logged out successfully');

      // Verify session deleted
      const sessions = await prisma.session.findMany({
        where: { userId: signupRes.json().user.id },
      });
      expect(sessions).toHaveLength(0);
    });

    it('should return 200 even without a cookie (graceful)', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ============================================
  // REFRESH
  // ============================================
  describe('POST /api/auth/refresh', () => {
    it('should return a new access token with valid refresh cookie', async () => {
      app = await buildApp();
      const payload = studentSignup();

      // Signup to get tokens
      const signupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload,
      });

      const cookies = signupRes.cookies as Array<{ name: string; value: string }>;
      const refreshCookie = cookies.find((c) => c.name === 'refreshToken');

      // Refresh
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refreshToken: refreshCookie!.value },
      });

      expect(refreshRes.statusCode).toBe(200);
      const body = refreshRes.json();
      expect(body.accessToken).toBeDefined();
      expect(body.accessToken).not.toBe(signupRes.json().accessToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      app = await buildApp();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { refreshToken: 'invalid-token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
