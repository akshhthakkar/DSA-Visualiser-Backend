// src/repositories/user.repository.ts
// Data access layer for User model.
// Justification: Backend-DevSkill.md — "Controller → Service → Repository"
// All queries filter deletedAt: null (soft delete).
// Never returns passwordHash unless explicitly requested.

import { prisma } from '../config/database.js';
import type { Prisma, UserRole } from '@prisma/client';

// Fields safe to return (excludes passwordHash)
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  lastLoginAt: true,
  loginCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SafeUser = Awaited<ReturnType<typeof findByEmail>> & Record<string, never>;

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

// --- Create user (optionally inside a transaction) ---
export async function create(data: CreateUserData, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  return client.user.create({
    data,
    select: safeUserSelect,
  });
}

// --- Find by email (returns passwordHash for auth verification) ---
export async function findByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { ...safeUserSelect, passwordHash: true },
  });
}

// --- Find by ID (safe, no passwordHash) ---
export async function findById(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: safeUserSelect,
  });
}

// --- Update last login timestamp and increment login count ---
export async function updateLastLogin(id: string) {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 },
    },
    select: safeUserSelect,
  });
}
