import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordAttempt,
  getProgressForProblem,
  getAllProgress,
} from '../../../services/progress.service.js';
import { createTestStudent, createTestUniversity } from '../../helpers/fixtures.js';
import { prisma } from '../../../config/database.js';
import { NotFoundError } from '../../../utils/errors.js';

describe('Progress Service', () => {
  let studentId: string;
  let problemId: string;

  beforeEach(async () => {
    const uni = await createTestUniversity({ emailDomains: ['test.edu'] });
    const studentData = await createTestStudent({ email: 'prog-student@test.edu' }, uni.id);
    studentId = studentData.user.id;

    const problem = await prisma.problem.create({
      data: {
        slug: `test-problem-${Date.now()}`,
        title: 'Test Problem',
        difficulty: 'EASY',
        description: 'Test',
        category: 'Arrays',
        topic: 'Arrays',
      },
    });
    problemId = problem.id;
  });

  describe('recordAttempt()', () => {
    it('should calculate new progress and save attempt successfully', async () => {
      const res = await recordAttempt(studentId, {
        problemId,
        status: 'SOLVED',
        timeSpentSeconds: 120,
      });

      expect(res.progress.problemId).toBe(problemId);
      expect(res.progress.status).toBe('SOLVED');
      expect(res.progress.attempts).toBe(1);
      expect(res.progress.timeSpentSeconds).toBe(120);
      expect(res.progress.solvedAt).toBeDefined();
    });

    it('should throw NotFoundError if problem does not exist', async () => {
      await expect(
        recordAttempt(studentId, {
          problemId: '00000000-0000-0000-0000-000000000000',
          status: 'ATTEMPTED',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getProgressForProblem()', () => {
    it('should return default not started representation if no progress is found', async () => {
      const res = await getProgressForProblem(studentId, problemId);
      expect(res.status).toBe('NOT_STARTED');
      expect(res.attempts).toBe(0);
    });

    it('should return progress if it exists', async () => {
      await recordAttempt(studentId, { problemId, status: 'SOLVED', timeSpentSeconds: 120 });
      const res = await getProgressForProblem(studentId, problemId);

      expect(res).not.toBeNull();
      expect(res!.status).toBe('SOLVED');
    });
  });

  describe('getAllProgress()', () => {
    it('should return a list of all progress items for student', async () => {
      await recordAttempt(studentId, { problemId, status: 'SOLVED', timeSpentSeconds: 120 });

      const res = await getAllProgress(studentId);
      expect(res).toHaveLength(1);
      expect(res[0]!.problemId).toBe(problemId);
      expect(res[0]!.problemTitle).toBe('Test Problem');
    });
  });
});
