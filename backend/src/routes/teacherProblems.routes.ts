import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { requireAuth, requireTeacher } from '../middleware/auth.middleware.js';

export default async function teacherProblemsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', requireAuth);
    app.addHook('onRequest', requireTeacher);

    // GET /api/teacher/problems
    // Returns built-in problems (createdByUserId: null) + this teacher's own custom ones
    app.get('/', async (req, reply) => {
        const problems = await prisma.problem.findMany({
            where: {
                OR: [
                    { createdByUserId: null },
                    { createdByUserId: req.user!.userId },
                ],
            },
            orderBy: [{ createdByUserId: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                title: true,
                slug: true,
                difficulty: true,
                topic: true,
                category: true,
                description: true,
                isPublished: true,
                createdByUserId: true,
                createdAt: true,
            },
        });
        return reply.send({ problems });
    });

    // POST /api/teacher/problems
    app.post('/', async (req, reply) => {
        const body = req.body as any;
        const { hiddenTestCases, ...problemBody } = body;
        const slug = `${(problemBody.title as string)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')}-${Date.now()}`;

        const problem = await prisma.$transaction(async (tx) => {
            const p = await tx.problem.create({
                data: {
                    title: problemBody.title,
                    slug,
                    description: problemBody.description || '',
                    topic: problemBody.topic || 'General',
                    difficulty: (problemBody.difficulty || 'EASY').toUpperCase() as any,
                    starterCode: problemBody.starterCode ?? null,
                    expectedOutput: problemBody.expectedOutput ?? null,
                    hints: problemBody.hints ?? null,
                    examples: problemBody.examples ?? null,
                    constraints: problemBody.constraints
                        ? (Array.isArray(problemBody.constraints)
                            ? JSON.stringify(problemBody.constraints)
                            : problemBody.constraints)
                        : null,
                    isPublished: false,
                    createdByUserId: req.user!.userId,
                },
            });

            // Save hidden test cases if provided
            if (Array.isArray(hiddenTestCases) && hiddenTestCases.length > 0) {
                await tx.hiddenTestCase.createMany({
                    data: hiddenTestCases.map((tc: any) => ({
                        problemId: p.id,
                        description: tc.description || null,
                        inputCode: tc.inputCode ?? {},
                        expectedOutput: tc.expectedOutput ?? '',
                    })),
                });
            }
            return p;
        });

        return reply.status(201).send({ problem });
    });

    // PUT /api/teacher/problems/:id
    app.put('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const body = req.body as any;
        const { hiddenTestCases, ...problemBody } = body;

        const existing = await prisma.problem.findFirst({
            where: { id, createdByUserId: req.user!.userId },
        });
        if (!existing) return reply.status(404).send({ message: 'Not found' });

        const updated = await prisma.$transaction(async (tx) => {
            const p = await tx.problem.update({
                where: { id },
                data: {
                    ...problemBody,
                    difficulty: problemBody.difficulty ? problemBody.difficulty.toUpperCase() : undefined,
                    constraints: problemBody.constraints
                        ? (Array.isArray(problemBody.constraints)
                            ? JSON.stringify(problemBody.constraints)
                            : problemBody.constraints)
                        : undefined,
                },
            });

            // Replace hidden test cases: delete old, insert new
            if (Array.isArray(hiddenTestCases)) {
                await tx.hiddenTestCase.deleteMany({ where: { problemId: id } });
                if (hiddenTestCases.length > 0) {
                    await tx.hiddenTestCase.createMany({
                        data: hiddenTestCases.map((tc: any) => ({
                            problemId: id,
                            description: tc.description || null,
                            inputCode: tc.inputCode ?? {},
                            expectedOutput: tc.expectedOutput ?? '',
                        })),
                    });
                }
            }
            return p;
        });

        return reply.send({ problem: updated });
    });


    // PATCH /api/teacher/problems/:id/publish — toggle
    app.patch('/:id/publish', async (req, reply) => {
        const { id } = req.params as { id: string };
        const existing = await prisma.problem.findFirst({
            where: { id, createdByUserId: req.user!.userId },
        });
        if (!existing) return reply.status(404).send({ message: 'Not found' });
        const updated = await prisma.problem.update({
            where: { id },
            data: { isPublished: !existing.isPublished },
        });
        return reply.send({ problem: updated });
    });

    // DELETE /api/teacher/problems/:id
    app.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const existing = await prisma.problem.findFirst({
            where: { id, createdByUserId: req.user!.userId },
        });
        if (!existing) return reply.status(404).send({ message: 'Not found' });
        await prisma.problem.delete({ where: { id } });
        return reply.send({ message: 'Deleted' });
    });
}
