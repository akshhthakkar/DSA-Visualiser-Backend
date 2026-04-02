// src/repositories/bulkStudent.repository.ts
// Data access layer for bulk student creation.
// Functional style (consistent with admin.repository.ts).
// Uses singleton prisma from config/database.ts.

import { prisma } from '../config/database.js';
import type { Prisma } from '@prisma/client';

// ============================================
// RESOLVE ADMIN'S UNIVERSITY
// Looks up admin's university via Teacher or Student profile.
// Returns universityId or null if admin has no profile.
// ============================================
export async function resolveAdminUniversity(userId: string): Promise<string | null> {
  // Check Teacher profile first (admins are often teachers)
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { universityId: true },
  });
  if (teacher) return teacher.universityId;

  // Check Student profile (unlikely but possible)
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { universityId: true },
  });
  if (student) return student.universityId;

  return null;
}

// ============================================
// GET UNIVERSITY WITH EMAIL DOMAINS
// Returns university data including emailDomains for validation.
// ============================================
export async function getUniversityWithDomains(universityId: string) {
  return prisma.university.findUnique({
    where: { id: universityId },
    select: {
      id: true,
      name: true,
      emailDomains: true,
      isActive: true,
      maxStudents: true,
    },
  });
}

// ============================================
// CHECK EXISTING EMAILS
// Returns a Set of emails that already exist in the database.
// ============================================
export async function findExistingEmails(emails: string[]): Promise<Set<string>> {
  const existing = await prisma.user.findMany({
    where: {
      email: { in: emails },
      deletedAt: null,
    },
    select: { email: true },
  });

  return new Set(existing.map((u) => u.email));
}

// ============================================
// CHECK EXISTING REGISTER NUMBERS (scoped to university)
// Returns a Set of register numbers already used within this university.
// ============================================
export async function findExistingRegisterNumbers(
  registerNumbers: string[],
  universityId: string
): Promise<Set<string>> {
  const existing = await prisma.student.findMany({
    where: {
      registerNumber: { in: registerNumbers },
      universityId,
    },
    select: { registerNumber: true },
  });

  return new Set(existing.map((s) => s.registerNumber));
}

// ============================================
// CREATE USER + STUDENT IN TRANSACTION
// Sets mustResetPassword: true for bulk-created accounts.
// ============================================
export async function createUserAndStudent(
  userData: {
    name: string;
    email: string;
    passwordHash: string;
  },
  studentData: {
    registerNumber: string;
    degree: string;
    batch: string;
    universityId: string;
  }
): Promise<{ userId: string }> {
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create user with STUDENT role
    const user = await tx.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        passwordHash: userData.passwordHash,
        role: 'STUDENT',
        emailVerified: false,
      },
      select: { id: true },
    });

    // Set mustResetPassword via raw SQL
    // (Prisma 7 adapter-pg runtime cache issue workaround)
    await tx.$executeRaw`UPDATE "users" SET "must_reset_password" = true WHERE "id" = ${user.id}::uuid`;

    // Create student profile
    await tx.student.create({
      data: {
        userId: user.id,
        registerNumber: studentData.registerNumber,
        degree: studentData.degree,
        batch: studentData.batch,
        universityId: studentData.universityId,
      },
    });

    return { userId: user.id };
  });

  return result;
}

// ============================================
// CREATE BULK IMPORT RECORD
// Records a bulk import for audit/history purposes.
// ============================================
export async function createBulkImportRecord(data: {
  universityId: string;
  createdBy: string;
  fileName: string;
  total: number;
  successful: number;
  failed: number;
  status: string;
  failedRows?: any;
  durationMs?: number;
  requestId?: string;
}) {
  return prisma.bulkImport.create({
    data: {
      universityId: data.universityId,
      createdBy: data.createdBy,
      fileName: data.fileName,
      total: data.total,
      successful: data.successful,
      failed: data.failed,
      status: data.status,
      failedRows: data.failedRows ?? undefined,
      durationMs: data.durationMs ?? null,
      requestId: data.requestId ?? null,
    },
  });
}

// ============================================
// GET BULK IMPORTS (paginated, for admin history)
// ============================================
export async function getBulkImports(
  universityId: string | null,
  page: number = 1,
  limit: number = 20
) {
  const skip = (page - 1) * limit;

  const where = universityId ? { universityId } : {};

  const [imports, total] = await Promise.all([
    prisma.bulkImport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        fileName: true,
        total: true,
        successful: true,
        failed: true,
        status: true,
        failedRows: true,
        durationMs: true,
        requestId: true,
        createdAt: true,
        admin: {
          select: { name: true, email: true },
        },
      },
    }),
    prisma.bulkImport.count({ where }),
  ]);

  return {
    imports,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
