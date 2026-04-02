// src/repositories/teacher.repository.ts
// Data access layer for Teacher / Class / ClassStudent models — Phase 4.
// Extended: getStudentRoadmapProgress for teacher-scoped roadmap view.
// Justification: implementation-roadmap.md Step 4.1
//
// Functional style (consistent with progress.repository.ts).
// Uses singleton prisma from config/database.ts.
//
// Design decisions:
//   - getClass uses findFirst with combined ownership + soft-delete filter.
//     Returns null if not found / not owned / soft-deleted — no existence leak.
//   - getStudentProgress: teacher can view any student enrolled in their classes.
//     Future: scope to class via GET /classes/:classId/students/:studentId/progress
//     when co-teaching is added.
//   - Pagination shape reserved on getClassStudents (limit/cursor).

import { prisma } from '../config/database.js';
import { NotFoundError, AuthorizationError, ConflictError } from '../utils/errors.js';

// ============================================
// FIND TEACHER BY USER ID
// ============================================
export async function findByUserId(userId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      university: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  return teacher;
}

// ============================================
// GET ALL CLASSES FOR TEACHER
// ============================================
export async function getClasses(teacherId: string) {
  return prisma.class.findMany({
    where: {
      primaryTeacherId: teacherId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      university: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

// ============================================
// GET SINGLE CLASS (ownership + soft-delete in one query)
// ============================================
// Uses findFirst with combined filters — no existence leak.
// Returns null if class doesn't exist, isn't owned, or is soft-deleted.
export async function getClass(classId: string, teacherId: string) {
  return prisma.class.findFirst({
    where: {
      id: classId,
      primaryTeacherId: teacherId,
      deletedAt: null,
    },
    include: {
      university: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });
}

// ============================================
// GET CLASS STUDENTS (with pagination shape)
// ============================================
// Pagination: limit defaults to 100, cursor uses Prisma skip+cursor pattern.
export async function getClassStudents(
  classId: string,
  teacherId: string,
  options?: { limit?: number; cursor?: string }
) {
  // Verify ownership first
  const classData = await getClass(classId, teacherId);
  if (!classData) {
    throw new NotFoundError('Class');
  }

  const limit = options?.limit ?? 100;

  return prisma.classStudent.findMany({
    where: { classId },
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      student: {
        user: {
          name: 'asc',
        },
      },
    },
    take: limit,
    ...(options?.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });
}

// ============================================
// SEARCH STUDENTS (same university, not enrolled)
// ============================================
export async function searchStudentsForClass(
  classId: string,
  teacherId: string,
  query: string,
  limit: number = 10
) {
  // Verify ownership
  const classData = await getClass(classId, teacherId);
  if (!classData) {
    throw new NotFoundError('Class');
  }

  // Get teacher's university
  const teacher = await prisma.teacher.findUnique({
    where: { userId: teacherId },
    select: { universityId: true },
  });
  if (!teacher) {
    throw new NotFoundError('Teacher');
  }

  // Get already-enrolled student IDs for this class
  const enrolled = await prisma.classStudent.findMany({
    where: { classId },
    select: { studentId: true },
  });
  const enrolledIds = enrolled.map((e) => e.studentId);

  const q = query.toLowerCase();

  return prisma.student.findMany({
    where: {
      universityId: teacher.universityId,
      userId: { notIn: enrolledIds.length > 0 ? enrolledIds : ['__none__'] },
      user: {
        isActive: true,
        deletedAt: null,
      },
      OR: [
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { registerNumber: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    take: limit,
    orderBy: {
      user: { name: 'asc' },
    },
  });
}

// ============================================
// ADD STUDENT TO CLASS
// ============================================
export async function addStudentToClass(classId: string, studentId: string, teacherId: string) {
  // Verify ownership
  const classData = await getClass(classId, teacherId);
  if (!classData) {
    throw new NotFoundError('Class');
  }

  // Verify student exists
  const student = await prisma.student.findUnique({
    where: { userId: studentId },
  });
  if (!student) {
    throw new NotFoundError('Student');
  }

  // Check for existing enrollment
  const existing = await prisma.classStudent.findUnique({
    where: {
      classId_studentId: { classId, studentId },
    },
  });
  if (existing) {
    throw new ConflictError('Student is already enrolled in this class');
  }

  return prisma.classStudent.create({
    data: {
      classId,
      studentId,
    },
  });
}

// ============================================
// REMOVE STUDENT FROM CLASS
// ============================================
export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  teacherId: string
) {
  // Verify ownership
  const classData = await getClass(classId, teacherId);
  if (!classData) {
    throw new NotFoundError('Class');
  }

  return prisma.classStudent.deleteMany({
    where: {
      classId,
      studentId,
    },
  });
}

// ============================================
// GET STUDENT PROGRESS (teacher-scoped)
// ============================================
// Authorization: teacher can view a student only if that student is
// enrolled in at least one class the teacher owns (and that class is
// not soft-deleted).
//
// FUTURE REFINEMENT: When co-teaching is added, scope access to a
// single class via GET /classes/:classId/students/:studentId/progress
// to prevent cross-context inference.
export async function getStudentProgress(studentId: string, teacherId: string) {
  // Verify student is enrolled in at least one of teacher's active classes
  const enrollment = await prisma.classStudent.findFirst({
    where: {
      studentId,
      class: {
        primaryTeacherId: teacherId,
        deletedAt: null,
      },
    },
  });

  if (!enrollment) {
    throw new AuthorizationError('Not authorized to view this student');
  }

  // Get per-problem progress
  const progress = await prisma.studentProgress.findMany({
    where: { studentId },
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
    orderBy: {
      updatedAt: 'desc',
    },
  });

  // Get status summary via groupBy
  const summary = await prisma.studentProgress.groupBy({
    by: ['status'],
    where: { studentId },
    _count: true,
  });

  // Get total problem count for notStarted calculation
  const totalProblems = await prisma.problem.count();

  return {
    progress,
    summary,
    totalProblems,
  };
}

// ============================================
// GET STUDENT ROADMAP PROGRESS (teacher-scoped)
// ============================================
// Authorization: same guard as getStudentProgress — student must be enrolled
// in at least one of this teacher's active classes.
export async function getStudentRoadmapProgress(studentId: string, teacherId: string) {
  // Verify student is enrolled in at least one of teacher's active classes
  const enrollment = await prisma.classStudent.findFirst({
    where: {
      studentId,
      class: {
        primaryTeacherId: teacherId,
        deletedAt: null,
      },
    },
  });

  if (!enrollment) {
    throw new AuthorizationError('Not authorized to view this student');
  }

  // Fetch all roadmap chapters with their problems and the student's progress
  const chapters = await prisma.roadmapChapter.findMany({
    orderBy: { order: 'asc' },
    include: {
      problems: {
        orderBy: { order: 'asc' },
        include: {
          progress: {
            where: { studentId },
            select: { status: true, solvedAt: true },
          },
        },
      },
    },
  });

  return chapters;
}
