// src/types/progress.types.ts
// Zod validation schemas + DTO interfaces for progress tracking — Phase 3.
// Justification: implementation-roadmap.md Step 3.3
//
// Design decision: every recordAttempt call increments attempts
// (one call = one visualization run). If we later want transition-only
// counting, change only the repository layer.
//
// Future: codeSubmission (max 50KB) is fine for now. At scale,
// consider moving to a separate table or object storage (S3).

import { z } from 'zod';

// ============================================
// RECORD ATTEMPT — POST /api/progress/record
// ============================================
export const recordAttemptSchema = z.object({
  problemId: z.string().uuid('Invalid problem ID'),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ATTEMPTED', 'SOLVED'], {
    error: 'Status must be NOT_STARTED, IN_PROGRESS, ATTEMPTED, or SOLVED',
  }),
  timeSpentSeconds: z.number().int().min(0, 'Time must be non-negative').optional(),
  variantUsed: z.string().max(100, 'Variant must be at most 100 characters').optional(),
  codeSubmission: z.string().max(50000, 'Code submission must be at most 50KB').optional(),
});

export type RecordAttemptInput = z.infer<typeof recordAttemptSchema>;

// ============================================
// GET ALL PROGRESS — GET /api/progress?status=&difficulty=&topic=
// ============================================
export const getProgressQuerySchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ATTEMPTED', 'SOLVED']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  topic: z.string().optional(),
});

export type GetProgressQuery = z.infer<typeof getProgressQuerySchema>;

// ============================================
// RESPONSE DTOs — services return these, controllers pass through
// ============================================
export interface ProgressRecordDTO {
  problemId: string;
  status: string;
  attempts: number;
  timeSpentSeconds: number;
  solvedAt: Date | null;
  lastAttemptedAt: Date | null;
}

export interface ProgressListItemDTO {
  problemId: string;
  problemTitle: string;
  difficulty: string;
  topic: string;
  status: string;
  attempts: number;
  timeSpentSeconds: number;
  solvedAt: Date | null;
  lastAttemptedAt: Date | null;
}
