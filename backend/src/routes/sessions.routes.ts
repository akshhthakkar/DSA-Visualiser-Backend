// src/routes/sessions.routes.ts  —  Interview Session routes
// Handles: create, join, end, get, run-code (with AutoScore via Socket.io)
import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';

const PISTON_URL = 'http://localhost:10200/api/v2/execute';

const LANG_CONFIG: Record<string, { language: string; version: string; ext: string }> = {
  javascript: { language: 'node', version: '18.15.0', ext: '.js' },
  python: { language: 'python', version: '3.10.0', ext: '.py' },
  java: { language: 'java', version: '15.0.2', ext: '.java' },
  cpp: { language: 'gcc', version: '10.2.0', ext: '.cpp' },
};

function normalize(str: string): string {
  return str.replace(/\s+/g, '');
}

export default async function sessionsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', requireAuth);

  // ── POST / — create a session ─────────────────────────────────
  app.post('/', async (req, reply) => {
    const { problems } = req.body as { problems: { title: string; difficulty: string }[] };
    if (!problems || problems.length === 0)
      return reply.status(400).send({ message: 'At least one problem is required' });

    const activeProblem = problems[0]?.title ?? 'Untitled Problem';
    const activeDifficulty = problems[0]?.difficulty ?? 'easy';
    const roomId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session = await prisma.interviewSession.create({
      data: {
        hostId: req.user!.userId,
        problems,
        problem: activeProblem,
        difficulty: activeDifficulty.toLowerCase(),
        status: 'active',
        roomId,
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
      },
    });

    return reply.status(201).send({ session });
  });

  // ── GET /active — list active sessions ──────────────────────────
  app.get('/active', async (_req, reply) => {
    const sessions = await prisma.interviewSession.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        host: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });
    return reply.send({ sessions });
  });

  // ── GET /my-recent — host's or candidate's recent sessions ──────
  app.get('/my-recent', async (req, reply) => {
    const userId = req.user!.userId;
    const sessions = await prisma.interviewSession.findMany({
      where: {
        status: 'completed',
        OR: [{ hostId: userId }, { candidateId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        host: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });
    return reply.send({ sessions });
  });

  // ── GET /:id — get single session ────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await prisma.interviewSession.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    return reply.send({ session });
  });

  // ── POST /:id/join — candidate joins a session ───────────────────
  app.post('/:id/join', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;
    const session = await prisma.interviewSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    if (session.status !== 'active')
      return reply.status(400).send({ message: 'Cannot join a completed session' });
    if (session.hostId === userId)
      return reply.status(400).send({ message: 'Host cannot join as candidate' });
    if (session.candidateId) return reply.status(409).send({ message: 'Session is full' });

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { candidateId: userId },
      include: {
        host: { select: { id: true, name: true, email: true } },
        candidate: { select: { id: true, name: true, email: true } },
      },
    });
    return reply.send({ session: updated });
  });

  // ── POST /:id/end — host ends the session ────────────────────────
  app.post('/:id/end', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;
    const session = await prisma.interviewSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    if (session.hostId !== userId)
      return reply.status(403).send({ message: 'Only the host can end the session' });
    if (session.status === 'completed')
      return reply.status(400).send({ message: 'Session already completed' });

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { status: 'completed' },
    });
    return reply.send({ session: updated, message: 'Session ended' });
  });

  // ── PATCH /:id/activeProblem — switch the active problem ─────────
  app.patch('/:id/activeProblem', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.userId;
    const { problemTitle, difficulty, codeToSave, previousProblemTitle } = req.body as {
      problemTitle: string;
      difficulty: string;
      codeToSave?: string;
      previousProblemTitle?: string;
    };

    const session = await prisma.interviewSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    if (session.hostId !== userId)
      return reply.status(403).send({ message: 'Only the host can switch problems' });

    const codes = (session.problemCodes as Record<string, string>) || {};
    if (previousProblemTitle && codeToSave !== undefined) codes[previousProblemTitle] = codeToSave;

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { problem: problemTitle, difficulty: difficulty.toLowerCase(), problemCodes: codes },
    });
    return reply.send({ session: updated });
  });

  // ── GET /:id/code/:problemTitle — get saved code for a problem ───
  app.get('/:id/code/:problemTitle', async (req, reply) => {
    const { id, problemTitle } = req.params as { id: string; problemTitle: string };
    const session = await prisma.interviewSession.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ message: 'Session not found' });
    const codes = (session.problemCodes as Record<string, string>) || {};
    return reply.send({ code: codes[problemTitle] ?? '' });
  });

  // ── PATCH /:id/score — update session score ──────────────────────
  app.patch('/:id/score', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { score } = req.body as { score: string };
    const updated = await prisma.interviewSession.update({ where: { id }, data: { score } });
    return reply.send({ session: updated });
  });

  // ── POST /run-code — execute code + auto-score in background ─────
  app.post('/run-code', async (req, reply) => {
    const { code, language, sessionId, problemTitle } = req.body as {
      code: string;
      language: string;
      sessionId: string;
      problemTitle: string;
    };

    const config = LANG_CONFIG[language] ?? LANG_CONFIG.javascript;

    // 1. Execute candidate code and return immediately
    let output = '';
    let stderr = '';
    try {
      const res = await fetch(PISTON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: config?.language ?? 'javascript',
          version: config?.version ?? '18.15.0',
          files: [{ content: code }],
        }),
      });
      const result = (await res.json()) as { run: { output: string; stderr: string } };
      output = result.run.output ?? '';
      stderr = result.run.stderr ?? '';
    } catch {
      return reply.status(500).send({ message: 'Code execution service unavailable' });
    }

    reply.send({ success: true, output, stderr });

    // 2. Background: run hidden test cases and emit to host
    setImmediate(async () => {
      try {
        const problem = await prisma.problem.findFirst({
          where: { title: problemTitle },
          include: { hiddenTestCases: true },
        });

        if (!problem || problem.hiddenTestCases.length === 0) return;

        const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
        if (!session) return;

        const results = await Promise.all(
          problem.hiddenTestCases.map(async (test) => {
            try {
              const inputCodes = test.inputCode as Record<string, string>;
              const testInput = inputCodes[language];
              if (!testInput) return null;

              const filename = language === 'java' ? 'Main.java' : `main${config?.ext ?? '.js'}`;
              const sanitizedCode =
                language === 'java' ? code.replace(/public\s+class/g, 'class') : code;

              let combined: string;
              if (language === 'java') {
                const importRe = /^\s*import\s+.*;/gm;
                const imports = sanitizedCode.match(importRe) ?? [];
                combined =
                  imports.join('\n') +
                  '\n' +
                  testInput +
                  '\n' +
                  sanitizedCode.replace(importRe, '');
              } else {
                combined = sanitizedCode + '\n' + testInput;
              }

              const res = await fetch(PISTON_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  language: config?.language ?? 'javascript',
                  version: config?.version ?? '18.15.0',
                  files: [{ name: filename, content: combined }],
                }),
              });
              const testResult = (await res.json()) as { run: { stdout: string; stderr: string } };
              const lines = (testResult.run.stdout ?? '').trim().split('\n').filter(Boolean);
              const actual = lines.at(-1)?.trim() ?? '';
              const passed = normalize(actual) === normalize(test.expectedOutput);

              return { id: test.id, description: test.description, passed };
            } catch {
              return { id: test.id, description: test.description, passed: false };
            }
          })
        );

        const finalResults = results.filter(Boolean) as {
          id: string;
          description: string | null;
          passed: boolean;
        }[];
        const passedCount = finalResults.filter((r) => r.passed).length;

        const io = (global as any).io;
        if (io) {
          io.to(`user_${session.hostId}`).emit('autoScoreResults', {
            sessionId,
            problemTitle,
            score: { passed: passedCount, total: finalResults.length },
            results: finalResults,
          });
        }

        // Save score to DB
        await prisma.interviewSession.update({
          where: { id: sessionId },
          data: { score: `${passedCount}/${finalResults.length}` },
        });
      } catch (err) {
        logger.error(`[AutoScore] Error: ${err}`);
      }
    });
  });
}
