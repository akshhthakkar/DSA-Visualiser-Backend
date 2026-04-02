// src/repositories/session.repository.ts
// Data access layer for Session model.
// Justification: Backend-DevSkill.md — "Controller → Service → Repository"
// Sessions store refresh tokens, IP, user agent for audit trail.

import { prisma } from '../config/database.js';

export interface CreateSessionData {
  userId: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  deviceFingerprint?: string;
}

// --- Create a new session ---
export async function create(data: CreateSessionData) {
  return prisma.session.create({ data });
}

// --- Find session by refresh token (include user for validation) ---
export async function findByRefreshToken(refreshToken: string) {
  return prisma.session.findUnique({
    where: { refreshToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });
}

// --- Delete a single session (logout) ---
export async function deleteByRefreshToken(refreshToken: string) {
  return prisma.session.deleteMany({
    where: { refreshToken },
  });
}

// --- Delete all sessions for a user (force logout all devices) ---
export async function deleteAllUserSessions(userId: string) {
  return prisma.session.deleteMany({
    where: { userId },
  });
}

// --- Update last activity timestamp ---
export async function updateLastActivity(refreshToken: string) {
  return prisma.session.update({
    where: { refreshToken },
    data: { lastActivityAt: new Date() },
  });
}
