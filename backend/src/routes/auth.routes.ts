// src/routes/auth.routes.ts
// Authentication endpoints — signup, login, logout, refresh.
// Justification: Backend-DevSkill.md — "Controller → Service → Repository"
// Routes are thin: parse request → call service → send response.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as authService from '../services/auth.service.js';
import * as userRepo from '../repositories/user.repository.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthenticationError } from '../utils/errors.js';
import { env } from '../config/env.js';
import type { SignupInput, LoginInput } from '../types/auth.types.js';

// Cookie config for refresh token
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export default async function authRoutes(app: FastifyInstance) {
  // --- Rate limiting per route ---
  // Signup: 5 requests / 15 minutes per IP
  app.post(
    '/signup',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest<{ Body: SignupInput }>, reply: FastifyReply) => {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] ?? 'unknown';

      const result = await authService.signup(request.body, ip, userAgent);

      return reply
        .setCookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS)
        .status(201)
        .send({
          user: result.user,
          accessToken: result.accessToken,
        });
    }
  );

  // Login: 10 requests / 15 minutes per IP
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) => {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] ?? 'unknown';

      const result = await authService.login(request.body, ip, userAgent);

      return reply
        .setCookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS)
        .status(200)
        .send({
          user: result.user,
          accessToken: result.accessToken,
        });
    }
  );

  // Logout: no aggressive rate limit needed
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] ?? 'unknown';
      await authService.logout(refreshToken, ip, userAgent);
    }

    return reply
      .clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
        path: '/api/auth',
      })
      .status(200)
      .send({ message: 'Logged out successfully' });
  });

  // Refresh: 30 requests / 15 minutes per IP
  app.post(
    '/refresh',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];

      if (!refreshToken) {
        return reply.status(401).send({
          error: 'AUTHENTICATION_ERROR',
          message: 'No refresh token provided',
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      return reply.status(200).send({
        accessToken: result.accessToken,
      });
    }
  );

  // GET /me — return current authenticated user (Phase 2)
  app.get(
    '/me',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await userRepo.findById(request.user!.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      return reply.status(200).send({ user });
    }
  );

  // Email Verification
  app.post('/verify-email', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] ?? 'unknown';

    await authService.verifyEmail(request.body, ip, userAgent);
    return reply.status(200).send({ message: 'Email successfully verified' });
  });

  app.post(
    '/resend-verification',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      await authService.resendVerificationEmail(request.body);
      return reply
        .status(200)
        .send({ message: 'If registered, a verification link has been sent' });
    }
  );

  // Password Reset
  app.post(
    '/forgot-password',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] ?? 'unknown';

      await authService.forgotPassword(request.body, ip, userAgent);
      return reply
        .status(200)
        .send({ message: 'If registered, a password reset link has been sent' });
    }
  );

  app.post(
    '/reset-password',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] ?? 'unknown';

      await authService.resetPassword(request.body, ip, userAgent);
      return reply.status(200).send({ message: 'Password successfully reset' });
    }
  );
}
