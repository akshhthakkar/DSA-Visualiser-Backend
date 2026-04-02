// src/middleware/auth.middleware.ts
// Authentication & authorization middleware — Phase 2.
// Justification: implementation-roadmap.md Step 2.1
//
// extractAccessToken(): single extraction point for the access token.
//   Currently reads Bearer header only. When cookie-based access tokens
//   are needed later, only this function changes.
//
// requireAuth: preHandler — verifies JWT, attaches user to request.
// requireRole: factory — checks user.role against allowed set.
// requireStudent / requireTeacher / requireAdmin: convenience exports.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/jwt.js';
import type { JWTPayload } from '../utils/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import type { UserRole } from '@prisma/client';
import { createFingerprint } from '../utils/fingerprint.js';

// --- Augment Fastify's request to carry the decoded JWT ---
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

// --- Token extraction (single point of change) ---
// Currently: Authorization: Bearer <token>
// Future: can fall back to cookie without touching callers.
function extractAccessToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// --- Require authenticated user ---
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractAccessToken(request);
  if (!token) {
    throw new AuthenticationError('No token provided');
  }

  // verifyToken throws AuthenticationError on invalid/expired tokens
  const payload = verifyToken(token);

  if (payload.fingerprint) {
    const currentFingerprint = createFingerprint(
      request.ip,
      request.headers['user-agent'] ?? 'unknown'
    );
    if (payload.fingerprint !== currentFingerprint) {
      throw new AuthenticationError('Session hijacked or invalid fingerprint');
    }
  }

  request.user = payload;
}

// --- Require specific role(s) (must come AFTER requireAuth) ---
export function requireRole(...roles: UserRole[]) {
  return async function checkRole(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!roles.includes(request.user.role)) {
      throw new AuthorizationError(`Requires role: ${roles.join(' or ')}`);
    }
  };
}

// --- Convenience role guards ---
export const requireStudent = requireRole('STUDENT' as UserRole);
export const requireTeacher = requireRole('TEACHER' as UserRole);
export const requireAdmin = requireRole('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole);
export const requireStudentOrTeacher = requireRole('STUDENT' as UserRole, 'TEACHER' as UserRole);
export const requireTeacherOrAdmin = requireRole(
  'TEACHER' as UserRole,
  'ADMIN' as UserRole,
  'SUPER_ADMIN' as UserRole
);
