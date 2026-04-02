// src/repositories/student.repository.ts
// Data access layer for Student model + progress queries — Phase 2.
// Justification: implementation-roadmap.md Step 2.2
//
// Functional style (consistent with user.repository.ts).
// Rules:
//   - totalProblems always from prisma.problem.count(), never from progress rows.
//   - recentActivity filters out NOT_STARTED (no noise).

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import type { ProgressStatus } from '@prisma/client';

// --- Safe user fields to include when joining student → user ---
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const universitySelect = {
  id: true,
  name: true,
} as const;

// ============================================
// FIND STUDENT BY USER ID
// ============================================
export async function findByUserId(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: { select: safeUserSelect },
      university: { select: universitySelect },
    },
  });

  if (!student) {
    throw new NotFoundError('Student profile');
  }

  return student;
}

// ============================================
// PROGRESS SUMMARY
// ============================================
// totalProblems comes from the problems table, NOT from progress rows.
// A student with zero progress still sees the correct total.
export async function getProgressSummary(userId: string) {
  const [totalProblems, progressByStatus] = await Promise.all([
    prisma.problem.count(),
    prisma.studentProgress.groupBy({
      by: ['status'],
      where: { studentId: userId },
      _count: true,
    }),
  ]);

  const countFor = (status: ProgressStatus) =>
    progressByStatus.find((p) => p.status === status)?._count ?? 0;

  const inProgress = countFor('IN_PROGRESS');
  const attempted = countFor('ATTEMPTED');
  const solved = countFor('SOLVED');

  return {
    totalProblems,
    notStarted: totalProblems - (inProgress + attempted + solved),
    inProgress,
    attempted,
    solved,
  };
}

// ============================================
// RECENT ACTIVITY
// ============================================
// Filters out NOT_STARTED — only shows problems the student interacted with.
export async function getRecentActivity(userId: string, limit = 5) {
  return prisma.studentProgress.findMany({
    where: {
      studentId: userId,
      status: { not: 'NOT_STARTED' },
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
    take: limit,
  });
}
