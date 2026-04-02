// src/services/progress.service.ts
// Business logic for student progress tracking — Phase 3.
// Justification: implementation-roadmap.md Step 3.2
//
// Functional style. Services return explicit DTOs, never raw Prisma shapes.
// Controllers are pure pass-through — no transformation.

import { prisma } from '../config/database.js';
import * as progressRepo from '../repositories/progress.repository.js';
import { NotFoundError } from '../utils/errors.js';
import type { ProgressStatus } from '@prisma/client';
import type {
  RecordAttemptInput,
  ProgressRecordDTO,
  ProgressListItemDTO,
} from '../types/progress.types.js';

// ============================================
// RECORD ATTEMPT
// ============================================
// Validates problem exists, then delegates to repo.
// Returns explicit DTO.
export async function recordAttempt(
  userId: string,
  input: RecordAttemptInput
): Promise<{ progress: ProgressRecordDTO }> {
  // Verify problem exists
  const problem = await prisma.problem.findUnique({
    where: { id: input.problemId },
  });

  if (!problem) {
    throw new NotFoundError('Problem');
  }

  const progress = await progressRepo.updateProgress(userId, input.problemId, {
    status: input.status as ProgressStatus,
    timeSpentSeconds: input.timeSpentSeconds,
    variantUsed: input.variantUsed,
    codeSubmission: input.codeSubmission,
  });

  return {
    progress: {
      problemId: progress.problemId,
      status: progress.status,
      attempts: progress.attempts,
      timeSpentSeconds: progress.timeSpentSeconds,
      solvedAt: progress.solvedAt,
      lastAttemptedAt: progress.lastAttemptedAt,
    },
  };
}

// ============================================
// GET PROGRESS FOR A SPECIFIC PROBLEM
// ============================================
// Returns persisted progress or a virtual NOT_STARTED default.
// Frontend note: when status === 'NOT_STARTED', this is a virtual
// default — no DB row exists. Don't treat lastAttemptedAt: null as real data.
export async function getProgressForProblem(
  userId: string,
  problemId: string
): Promise<ProgressRecordDTO> {
  const progress = await progressRepo.getForProblem(userId, problemId);

  if (!progress) {
    return {
      problemId,
      status: 'NOT_STARTED',
      attempts: 0,
      timeSpentSeconds: 0,
      solvedAt: null,
      lastAttemptedAt: null,
    };
  }

  return {
    problemId: progress.problemId,
    status: progress.status,
    attempts: progress.attempts,
    timeSpentSeconds: progress.timeSpentSeconds,
    solvedAt: progress.solvedAt,
    lastAttemptedAt: progress.lastAttemptedAt,
  };
}

// ============================================
// GET ALL PROGRESS (with optional filters)
// ============================================
export async function getAllProgress(
  userId: string,
  filters?: {
    status?: string;
    difficulty?: string;
    topic?: string;
  }
): Promise<ProgressListItemDTO[]> {
  const allProgress = await progressRepo.getAll(userId, {
    status: filters?.status as ProgressStatus | undefined,
    difficulty: filters?.difficulty,
    topic: filters?.topic,
  });

  return allProgress.map((p) => ({
    problemId: p.problem.id,
    problemTitle: p.problem.title,
    difficulty: p.problem.difficulty,
    topic: p.problem.topic,
    status: p.status,
    attempts: p.attempts,
    timeSpentSeconds: p.timeSpentSeconds,
    solvedAt: p.solvedAt,
    lastAttemptedAt: p.lastAttemptedAt,
  }));
}
