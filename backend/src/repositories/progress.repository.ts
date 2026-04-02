// src/repositories/progress.repository.ts
// Data access layer for StudentProgress model — Phase 3.
// Justification: implementation-roadmap.md Step 3.1
//
// Functional style (consistent with student.repository.ts, user.repository.ts).
// Uses singleton prisma from config/database.ts.
//
// Design decisions:
//   - findOrCreate + update wrapped in $transaction to prevent interleaving.
//   - Every recordAttempt call increments attempts (one call = one visualization run).
//   - solvedAt set only on first solve (never overwritten).

import { prisma } from '../config/database.js';
import type { ProgressStatus, Prisma } from '@prisma/client';

// ============================================
// FIND OR CREATE PROGRESS ROW
// ============================================
// Upserts using the compound unique (studentId, problemId).
// Creates with NOT_STARTED if no row exists.
export async function findOrCreate(
  studentId: string,
  problemId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return client.studentProgress.upsert({
    where: {
      studentId_problemId: { studentId, problemId },
    },
    create: {
      studentId,
      problemId,
      status: 'NOT_STARTED' as ProgressStatus,
    },
    update: {},
  });
}

// ============================================
// UPDATE PROGRESS (transactional)
// ============================================
// Wraps findOrCreate + update in $transaction to prevent
// interleaving under concurrent requests.
export async function updateProgress(
  studentId: string,
  problemId: string,
  data: {
    status: ProgressStatus;
    timeSpentSeconds?: number;
    variantUsed?: string;
    codeSubmission?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findOrCreate(studentId, problemId, tx);

    const updateData: Prisma.StudentProgressUpdateInput = {
      status: data.status,
      attempts: { increment: 1 },
      lastAttemptedAt: new Date(),
    };

    if (data.timeSpentSeconds !== undefined) {
      updateData.timeSpentSeconds = { increment: data.timeSpentSeconds };
    }

    if (data.variantUsed !== undefined) {
      updateData.variantUsed = data.variantUsed;
    }

    if (data.codeSubmission !== undefined) {
      updateData.codeSubmission = data.codeSubmission;
    }

    // solvedAt set only on FIRST solve — never overwritten
    if (data.status === ('SOLVED' as ProgressStatus) && !existing.solvedAt) {
      updateData.solvedAt = new Date();
    }

    return tx.studentProgress.update({
      where: {
        studentId_problemId: { studentId, problemId },
      },
      data: updateData,
    });
  });
}

// ============================================
// GET PROGRESS FOR A SPECIFIC PROBLEM
// ============================================
export async function getForProblem(studentId: string, problemId: string) {
  return prisma.studentProgress.findUnique({
    where: {
      studentId_problemId: { studentId, problemId },
    },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          topic: true,
        },
      },
    },
  });
}

// ============================================
// GET ALL PROGRESS (with optional filters)
// ============================================
export async function getAll(
  studentId: string,
  filters?: {
    status?: ProgressStatus;
    difficulty?: string;
    topic?: string;
  }
) {
  return prisma.studentProgress.findMany({
    where: {
      studentId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.difficulty && {
        problem: { difficulty: filters.difficulty as Prisma.EnumDifficultyFilter },
      }),
      ...(filters?.topic && {
        problem: { topic: filters.topic },
      }),
    },
    include: {
      problem: {
        select: {
          id: true,
          title: true,
          difficulty: true,
          topic: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}
