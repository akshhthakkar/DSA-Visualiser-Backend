import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestServer, closeTestServer } from '../helpers/testServer.js';
import { createTestUniversity, createTestUser } from '../helpers/fixtures.js';
import * as auditService from '../../services/audit.service.js';

vi.spyOn(auditService, 'logAuthEvent').mockResolvedValue(undefined);

describe('Auth Routes', () => {
  let app: FastifyInstance;
  let universityId: string;

  beforeEach(async () => {
    app = await getTestServer();
    const uni = await createTestUniversity();
    universityId = uni.id;
  });

  afterAll(async () => {
    await closeTestServer();
  });

  describe('POST /api/auth/signup', () => {
    it('should successfully register a new student and return tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          name: 'Integration Student',
          email: 'integration@test.edu',
          password: 'Password@123',
          role: 'STUDENT',
          universityId,
          registerNumber: 'REG-INT-001',
          degree: 'B.Tech',
          batch: '2025',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.payload);
      expect(body.user.email).toBe('integration@test.edu');
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.accessToken).toBeDefined();

      // Check cookies for refresh token
      const cookies = response.cookies;
      const refreshTokenCookie = cookies.find(c => c.name === 'refreshToken');
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie?.httpOnly).toBe(true);
    });

    it('should fail with 400 for missing required student fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: {
          name: 'Integration Student',
          email: 'bad@test.edu',
          password: 'Password@123',
          role: 'STUDENT',
          universityId,
          // Missing registerNumber, etc.
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser({
        name: 'Login API User',
        email: 'api.login@test.edu',
        password: 'ValidPassword@123',
      });
    });

    it('should return 200 with tokens for valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'api.login@test.edu',
          password: 'ValidPassword@123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.user.email).toBe('api.login@test.edu');
      expect(body.accessToken).toBeDefined();

      const refreshCookie = response.cookies.find(c => c.name === 'refreshToken');
      expect(refreshCookie).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'api.login@test.edu',
          password: 'WrongPassword@123',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe('AUTHENTICATION_ERROR');
      expect(body.message).toBe('Invalid credentials');
    });
  });
});
