// src/services/student.service.ts
// Student dashboard business logic — Phase 2.
// Justification: implementation-roadmap.md Step 2.3
//
// Rule: services return explicit DTOs, not raw Prisma shapes.
// Controllers just pass DTOs through — no transformation.

import * as studentRepo from '../repositories/student.repository.js';
import type { StudentDashboardDTO, StudentProgressDTO } from '../types/student.types.js';

// ============================================
// GET DASHBOARD
// ============================================
export async function getDashboard(userId: string): Promise<StudentDashboardDTO> {
  // Parallel fetch — no dependencies between these three
  const [student, progressSummary, recentActivityRaw] = await Promise.all([
    studentRepo.findByUserId(userId),
    studentRepo.getProgressSummary(userId),
    studentRepo.getRecentActivity(userId),
  ]);

  // Map to explicit DTO — never leak Prisma internals
  return {
    student: {
      id: student.userId,
      name: student.user.name,
      email: student.user.email,
      registerNumber: student.registerNumber,
      degree: student.degree,
      batch: student.batch,
      university: {
        id: student.university.id,
        name: student.university.name,
      },
    },
    progress: progressSummary,
    recentActivity: recentActivityRaw.map((activity) => ({
      problemId: activity.problem.id,
      problemTitle: activity.problem.title,
      difficulty: activity.problem.difficulty,
      topic: activity.problem.topic,
      status: activity.status,
      attempts: activity.attempts,
      lastAttemptedAt: activity.lastAttemptedAt,
    })),
  };
}

// ============================================
// GET PROGRESS
// ============================================
export async function getProgress(userId: string): Promise<StudentProgressDTO> {
  const summary = await studentRepo.getProgressSummary(userId);

  return {
    summary,
  };
}
