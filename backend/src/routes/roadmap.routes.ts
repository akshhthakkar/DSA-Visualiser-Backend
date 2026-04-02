import type { FastifyInstance } from 'fastify';
import { prisma } from '../config/database.js';
import { requireAuth, requireStudentOrTeacher } from '../middleware/auth.middleware.js';

export default async function roadmapRoutes(app: FastifyInstance) {
    app.addHook('onRequest', requireAuth);
    app.addHook('onRequest', requireStudentOrTeacher);

    // GET /api/roadmap  — all chapters + student's progress per problem
    app.get('/', async (req, reply) => {
        const studentId = req.user!.userId;
        const chapters = await prisma.roadmapChapter.findMany({
            orderBy: { order: 'asc' },
            include: {
                problems: {
                    orderBy: { order: 'asc' },
                    include: {
                        progress: { where: { studentId }, select: { status: true, solvedAt: true } },
                        problem: { select: { slug: true } }
                    },
                },
            },
        });

        const result = chapters.map((ch) => ({
            ...ch,
            solvedCount: ch.problems.filter((p) => p.progress[0]?.status === 'SOLVED').length,
            problems: ch.problems.map((p) => ({
                ...p,
                myStatus: p.progress[0]?.status ?? 'NOT_STARTED',
                progress: undefined,
            })),
        }));

        return reply.send({ chapters: result });
    });

    // PATCH /api/roadmap/problems/:id/status  — student marks a problem
    app.patch('/problems/:id/status', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { status } = req.body as { status: string };
        const studentId = req.user!.userId;

        if (req.user!.role !== 'STUDENT') {
            return reply.send({
                progress: {
                    status: status as any,
                    solvedAt: status === 'SOLVED' ? new Date() : null,
                }
            });
        }

        const progress = await prisma.roadmapProgress.upsert({
            where: { studentId_roadmapProblemId: { studentId, roadmapProblemId: id } },
            update: {
                status: status as any,
                solvedAt: status === 'SOLVED' ? new Date() : null,
            },
            create: {
                studentId,
                roadmapProblemId: id,
                status: status as any,
                solvedAt: status === 'SOLVED' ? new Date() : null,
            },
        });

        return reply.send({ progress });
    });

    // PATCH /api/roadmap/problems/by-global-id/:id/status
    app.patch('/problems/by-global-id/:id/status', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { status } = req.body as { status: string };
        const studentId = req.user!.userId;

        if (req.user!.role !== 'STUDENT') {
            return reply.send({
                success: true,
                progress: {
                    status: status as any,
                    solvedAt: status === 'SOLVED' ? new Date() : null,
                }
            });
        }

        const roadmapProblem = await prisma.roadmapProblem.findFirst({
            where: { problemId: id }
        });

        if (!roadmapProblem) return reply.send({ success: false });

        const progress = await prisma.roadmapProgress.upsert({
            where: { studentId_roadmapProblemId: { studentId, roadmapProblemId: roadmapProblem.id } },
            update: {
                status: status as any,
                solvedAt: status === 'SOLVED' ? new Date() : null,
            },
            create: {
                studentId,
                roadmapProblemId: roadmapProblem.id,
                status: status as any,
                solvedAt: status === 'SOLVED' ? new Date() : null,
            },
        });

        return reply.send({ success: true, progress });
    });

    // GET /api/roadmap/stats  — for student dashboard progress ring
    app.get('/stats', async (req, reply) => {
        const studentId = req.user!.userId;
        const total = await prisma.roadmapProblem.count();
        const solved = await prisma.roadmapProgress.count({
            where: { studentId, status: 'SOLVED' },
        });
        return reply.send({
            total,
            solved,
            percentage: total > 0 ? Math.round((solved / total) * 100) : 0,
        });
    });
}
