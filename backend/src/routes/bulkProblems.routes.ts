// src/routes/bulkProblems.routes.ts
// Bulk problem import endpoints — adapted from CodeHire problemController.js logic.
// Security: requireAuth + requireAdmin on all routes | rate-limited (3/hr) | max 50 problems per batch

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma, Difficulty } from '@prisma/client';
import { requireAuth, requireTeacherOrAdmin } from '../middleware/auth.middleware.js';
import { prisma } from '../config/database.js';
import { ValidationError } from '../utils/errors.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProblemInput {
  title: string;
  difficulty: string;
  category?: string;
  description: string | { text: string; notes?: string[] };
  constraints?: string[];
  examples?: { input: string; output: string; explanation?: string }[];
  starterCode?: Record<string, string>;
  expectedOutput?: Record<string, string>;
  hiddenTestCases?: unknown[];
}

function normalizeDifficulty(input: string): Difficulty | null {
  switch (input.trim().toLowerCase()) {
    case 'easy':
      return 'EASY';
    case 'medium':
      return 'MEDIUM';
    case 'hard':
      return 'HARD';
    default:
      return null;
  }
}

// ── Server-side validation (mirrors CodeHire validateProblemServer) ────────────

function validateProblem(problem: unknown, index: number): string[] {
  const errors: string[] = [];
  const p = problem as ProblemInput;
  const label = `Problem ${index + 1}`;

  if (!p.title || typeof p.title !== 'string' || p.title.trim() === '')
    errors.push(`${label}: title is required`);
  else if (p.title.trim().length > 100) errors.push(`${label}: title too long (max 100 chars)`);

  if (!p.difficulty || normalizeDifficulty(p.difficulty) === null)
    errors.push(`${label}: difficulty must be 'Easy', 'Medium', or 'Hard'`);

  if (!p.description) errors.push(`${label}: description is required`);
  else if (typeof p.description === 'object') {
    const desc = p.description as { text?: string };
    if (!desc.text || typeof desc.text !== 'string' || desc.text.trim() === '')
      errors.push(`${label}: description.text is required`);
    else if (desc.text.length > 10000)
      errors.push(`${label}: description.text too long (max 10,000 chars)`);
  } else if (typeof p.description === 'string') {
    if (p.description.trim() === '') errors.push(`${label}: description cannot be empty`);
  }

  if (p.examples !== undefined && !Array.isArray(p.examples))
    errors.push(`${label}: examples must be an array`);
  if (
    p.starterCode !== undefined &&
    (typeof p.starterCode !== 'object' || Array.isArray(p.starterCode))
  )
    errors.push(`${label}: starterCode must be an object`);
  if (p.constraints !== undefined && !Array.isArray(p.constraints))
    errors.push(`${label}: constraints must be an array`);

  return errors;
}

async function checkDuplicates(problems: ProblemInput[], createdByUserId: string) {
  const incomingTitles = problems.map((p) => p.title.trim());

  // Internal duplicates (within the uploaded batch)
  const titleCounts: Record<string, number> = {};
  incomingTitles.forEach((t) => {
    titleCounts[t] = (titleCounts[t] || 0) + 1;
  });
  const internalDuplicates = Object.entries(titleCounts)
    .filter(([, count]) => count > 1)
    .map(([title]) => title);

  // Database duplicates
  const existing = await prisma.problem.findMany({
    where: { createdByUserId, title: { in: incomingTitles } },
    select: { title: true },
  });
  const dbDuplicates = existing.map((p) => p.title);
  const allDuplicates = [...new Set([...dbDuplicates, ...internalDuplicates])];

  return {
    dbDuplicates,
    internalDuplicates,
    allDuplicates,
    newProblems: problems.filter((p) => !allDuplicates.includes(p.title.trim())),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export default async function bulkProblemsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);
  app.addHook('onRequest', requireTeacherOrAdmin);

  // ========================================================
  // POST /bulk/problems/import — JSON body bulk create
  // Rate limited: 3 requests per hour
  // ========================================================
  app.post(
    '/import',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { problems?: unknown[] };
      const rawProblems = body?.problems;

      if (!rawProblems || !Array.isArray(rawProblems))
        throw new ValidationError('Problems must be an array');
      if (rawProblems.length === 0) throw new ValidationError('No problems provided');
      if (rawProblems.length > 50)
        throw new ValidationError(
          `Maximum 50 problems allowed. Your batch has ${rawProblems.length}`
        );

      // Server-side validation
      const validationResults = rawProblems.map((p, i) => ({
        problem: p as ProblemInput,
        errors: validateProblem(p, i),
      }));
      const invalid = validationResults.filter((r) => r.errors.length > 0);
      const valid = validationResults.filter((r) => r.errors.length === 0).map((r) => r.problem);

      if (valid.length === 0) {
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'All problems failed validation',
          details: invalid.map((r) => r.errors),
        });
      }

      // Duplicate check
      const { dbDuplicates, internalDuplicates, allDuplicates, newProblems } =
        await checkDuplicates(valid, request.user!.userId);

      if (newProblems.length === 0) {
        return reply.status(400).send({
          code: 'ALL_DUPLICATES',
          message: 'All problems already exist in the problem bank',
          duplicates: allDuplicates,
        });
      }

      // Save in a transaction (all or nothing)
      await prisma.$transaction(async (tx) => {
        const data = newProblems.map((p) => {
          const diff = normalizeDifficulty(p.difficulty);
          if (diff === null) {
            throw new ValidationError(`Invalid difficulty value for problem: ${p.title}`);
          }
          const slug = `${p.title
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')}-${Math.random().toString(36).substring(2, 7)}`;

          const descText =
            typeof p.description === 'object'
              ? (p.description as { text: string }).text
              : p.description;

          return {
            title: p.title.trim(),
            slug,
            description: descText,
            topic: 'General',
            difficulty: diff,
            category: (p.category || '').trim() || null,
            // constraints is String? in schema — store as JSON string
            constraints: p.constraints?.length ? JSON.stringify(p.constraints) : null,
            // examples/starterCode/expectedOutput/hints are Json? in schema
            examples: p.examples?.length ? (p.examples as Prisma.InputJsonValue) : Prisma.JsonNull,
            starterCode:
              p.starterCode && Object.keys(p.starterCode).length
                ? (p.starterCode as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            expectedOutput:
              p.expectedOutput && Object.keys(p.expectedOutput).length
                ? (p.expectedOutput as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            hints: Prisma.JsonNull,
            isPublished: false,
            createdByUserId: request.user!.userId,
          };
        });
        await tx.problem.createMany({ data });
      });

      return reply.status(201).send({
        created: newProblems.length,
        skipped: dbDuplicates.length,
        skippedInvalid: invalid.length,
        internalDuplicates,
        duplicates: dbDuplicates,
        message: `Successfully imported ${newProblems.length} problem${newProblems.length !== 1 ? 's' : ''}`,
      });
    }
  );

  // ========================================================
  // GET /bulk/problems/template — Download the JSON template
  // ========================================================
  app.get('/template', async (_request: FastifyRequest, reply: FastifyReply) => {
    const template = [
      {
        title: 'Two Sum',
        difficulty: 'Easy',
        category: 'Array • Hash Table',
        description: {
          text: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
          notes: ['You can return the answer in any order.'],
        },
        constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9'],
        examples: [
          {
            input: 'nums = [2,7,11,15], target = 9',
            output: '[0,1]',
            explanation: 'nums[0] + nums[1] == 9',
          },
        ],
        starterCode: {
          javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n}',
          python: 'def twoSum(nums, target):\n    pass',
          java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}',
          cpp: '#include <bits/stdc++.h>\nusing namespace std;\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return {};\n    }\n};',
        },
        expectedOutput: {
          javascript: '[0,1]',
          python: '[0, 1]',
          java: '[0, 1]',
          cpp: '[0, 1]',
        },
      },
    ];

    void reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="problems_template.json"')
      .send(JSON.stringify(template, null, 2));
  });
}
