import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { requireAuth, requireStudentOrTeacher } from '../middleware/auth.middleware.js';

export default async function studentProblemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', requireAuth);
    app.addHook('onRequest', requireStudentOrTeacher);

    // GET /api/student/problems  — all published problems
    app.get('/', async (_req, reply) => {
        const problems = await prisma.problem.findMany({
            where: { isPublished: true },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                title: true,
                slug: true,
                difficulty: true,
                topic: true,
                category: true,
                description: true,
                examples: true,
                constraints: true,
                createdByUserId: true,
            },
        });
        return reply.send({ problems });
    });

    // GET /api/student/problems/:slug
    app.get('/:slug', async (req, reply) => {
        const { slug } = req.params as { slug: string };
        const problem = await prisma.problem.findUnique({ where: { slug } });
        if (!problem) return reply.status(404).send({ message: 'Not found' });
        return reply.send({ problem });
    });

    // POST /api/student/problems/:id/submit
    // This is what updates the progress bar.
    app.post('/:id/submit', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { code, passed, timeSpentSeconds } = req.body as any;
        const studentId = req.user!.userId;

        const progress = await prisma.studentProgress.upsert({
            where: { studentId_problemId: { studentId, problemId: id } },
            update: {
                status: passed ? 'SOLVED' : 'ATTEMPTED',
                codeSubmission: code,
                attempts: { increment: 1 },
                lastAttemptedAt: new Date(),
                ...(passed ? { solvedAt: new Date() } : {}),
                timeSpentSeconds: { increment: timeSpentSeconds || 0 },
            },
            create: {
                studentId,
                problemId: id,
                status: passed ? 'SOLVED' : 'ATTEMPTED',
                codeSubmission: code,
                attempts: 1,
                lastAttemptedAt: new Date(),
                solvedAt: passed ? new Date() : null,
                timeSpentSeconds: timeSpentSeconds || 0,
            },
        });

        // Emit real-time progress update event for this student
        // This is picked up by TeacherDashboard and StudentDashboard
        if ((global as any).io) {
            (global as any).io.emit('student:progress', { studentId });
        }

        return reply.send({ progress, passed });
    });
}
