// src/services/teacher.service.ts
// Business logic for teacher class management — Phase 4.
// Justification: implementation-roadmap.md Step 4.2
//
// Functional style. Services return explicit DTOs, never raw Prisma shapes.
// Controllers are pure pass-through — no transformation.

import { prisma } from '../config/database.js';
import * as teacherRepo from '../repositories/teacher.repository.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import type {
  CreateTeacherClassInput,
  TeacherProfileDTO,
  ClassListItemDTO,
  ClassDetailDTO,
  ClassStudentDTO,
  StudentProgressViewDTO,
  SearchStudentResultDTO,
  RoadmapChapterProgressDTO,
} from '../types/teacher.types.js';

// ============================================
// GET TEACHER PROFILE
// ============================================
export async function getProfile(userId: string): Promise<TeacherProfileDTO> {
  const teacher = await teacherRepo.findByUserId(userId);

  return {
    userId: teacher.userId,
    name: teacher.user.name,
    email: teacher.user.email,
    department: teacher.department,
    university: {
      id: teacher.university.id,
      name: teacher.university.name,
    },
  };
}

// ============================================
// GET ALL CLASSES
// ============================================
export async function getClasses(userId: string): Promise<ClassListItemDTO[]> {
  const classes = await teacherRepo.getClasses(userId);

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    degree: c.degree,
    batch: c.batch,
    semester: c.semester,
    academicYear: c.academicYear,
    universityName: c.university.name,
    studentCount: c._count.enrollments,
    isActive: c.isActive,
    createdAt: c.createdAt,
  }));
}

// ============================================
// CREATE CLASS
// ============================================
export async function createClass(
  userId: string,
  data: CreateTeacherClassInput
): Promise<ClassDetailDTO> {
  const teacher = await teacherRepo.findByUserId(userId);

  const createData = {
    ...data,
    universityId: teacher.universityId,
    primaryTeacherId: teacher.userId,
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
  };

  const result = await teacherRepo.createClass(createData);

  if (!result.success) {
    if (result.error === 'DUPLICATE_CLASS_CODE') {
      throw new ConflictError('Class code already exists in your university');
    }

    throw new Error(`Unexpected repository error: ${result.error}`);
  }

  const createdClass = result.class;

  return {
    id: createdClass.id,
    name: createdClass.name,
    code: createdClass.code,
    degree: createdClass.degree,
    batch: createdClass.batch,
    semester: createdClass.semester,
    academicYear: createdClass.academicYear,
    universityName: createdClass.university.name,
    studentCount: createdClass._count.enrollments,
    isActive: createdClass.isActive,
    createdAt: createdClass.createdAt,
    maxStudents: createdClass.maxStudents,
    startDate: createdClass.startDate,
    endDate: createdClass.endDate,
  };
}

// ============================================
// GET SINGLE CLASS
// ============================================
export async function getClass(classId: string, userId: string): Promise<ClassDetailDTO> {
  const classData = await teacherRepo.getClass(classId, userId);

  if (!classData) {
    throw new NotFoundError('Class');
  }

  return {
    id: classData.id,
    name: classData.name,
    code: classData.code,
    degree: classData.degree,
    batch: classData.batch,
    semester: classData.semester,
    academicYear: classData.academicYear,
    universityName: classData.university.name,
    studentCount: classData._count.enrollments,
    isActive: classData.isActive,
    createdAt: classData.createdAt,
    maxStudents: classData.maxStudents,
    startDate: classData.startDate,
    endDate: classData.endDate,
  };
}

// ============================================
// GET CLASS STUDENTS (with pagination shape)
// ============================================
export async function getClassStudents(
  classId: string,
  userId: string,
  query?: { limit?: number; cursor?: string }
): Promise<{ students: ClassStudentDTO[]; nextCursor: string | null }> {
  const limit = query?.limit ?? 100;
  const enrollments = await teacherRepo.getClassStudents(classId, userId, {
    limit,
    cursor: query?.cursor,
  });

  const students = enrollments.map((e) => ({
    userId: e.student.userId,
    name: e.student.user.name,
    email: e.student.user.email,
    registerNumber: e.student.registerNumber,
    degree: e.student.degree,
    batch: e.student.batch,
    enrolledAt: e.enrolledAt,
  }));

  // nextCursor: last item's id if we got a full page, else null
  const lastEnrollment = enrollments[enrollments.length - 1];
  const nextCursor = enrollments.length === limit && lastEnrollment ? lastEnrollment.id : null;

  return { students, nextCursor };
}

// ============================================
// SEARCH STUDENTS (same university, not enrolled)
// ============================================
export async function searchStudents(
  classId: string,
  userId: string,
  query: string,
  limit?: number
): Promise<SearchStudentResultDTO[]> {
  const results = await teacherRepo.searchStudentsForClass(classId, userId, query, limit);

  return results.map((s) => ({
    userId: s.userId,
    name: s.user.name,
    email: s.user.email,
    registerNumber: s.registerNumber,
    degree: s.degree,
    batch: s.batch,
  }));
}

// ============================================
// ADD STUDENT TO CLASS
// ============================================
export async function addStudent(
  classId: string,
  studentId: string,
  userId: string
): Promise<{ message: string }> {
  await teacherRepo.addStudentToClass(classId, studentId, userId);
  return { message: 'Student added successfully' };
}

// ============================================
// REMOVE STUDENT FROM CLASS
// ============================================
export async function removeStudent(
  classId: string,
  studentId: string,
  userId: string
): Promise<{ message: string }> {
  await teacherRepo.removeStudentFromClass(classId, studentId, userId);
  return { message: 'Student removed successfully' };
}

// ============================================
// GET STUDENT PROGRESS (teacher view)
// ============================================
export async function getStudentProgress(
  studentId: string,
  userId: string
): Promise<StudentProgressViewDTO> {
  // Run both queries in parallel — roadmap re-checks auth but that's a fast index lookup
  const [{ progress, summary, totalProblems }, roadmapChapters, student] = await Promise.all([
    teacherRepo.getStudentProgress(studentId, userId),
    teacherRepo.getStudentRoadmapProgress(studentId, userId),
    prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  if (!student) {
    throw new NotFoundError('Student');
  }

  // Build summary from groupBy result
  const tracked = summary.reduce((sum, s) => sum + s._count, 0);
  const inProgress = summary.find((s) => s.status === 'IN_PROGRESS')?._count ?? 0;
  const attempted = summary.find((s) => s.status === 'ATTEMPTED')?._count ?? 0;
  const solved = summary.find((s) => s.status === 'SOLVED')?._count ?? 0;

  // Build roadmap DTO
  const roadmapChapterDTOs: RoadmapChapterProgressDTO[] = roadmapChapters.map((ch) => {
    const problems = ch.problems.map((p) => ({
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      topic: p.topic,
      status: p.progress[0]?.status ?? 'NOT_STARTED',
      solvedAt: p.progress[0]?.solvedAt ?? null,
    }));

    const solvedCount = problems.filter((p) => p.status === 'SOLVED').length;

    return {
      id: ch.id,
      title: ch.title,
      order: ch.order,
      totalProblems: ch.problems.length,
      solvedCount,
      problems,
    };
  });

  const roadmapTotal = roadmapChapterDTOs.reduce((s, ch) => s + ch.totalProblems, 0);
  const roadmapSolved = roadmapChapterDTOs.reduce((s, ch) => s + ch.solvedCount, 0);

  return {
    student: {
      userId: studentId,
      name: student.user.name,
      email: student.user.email,
      registerNumber: student.registerNumber,
    },
    summary: {
      totalProblems,
      notStarted: totalProblems - tracked,
      inProgress,
      attempted,
      solved,
    },
    progress: progress.map((p) => ({
      problemId: p.problem.id,
      problemTitle: p.problem.title,
      difficulty: p.problem.difficulty,
      topic: p.problem.topic,
      status: p.status,
      attempts: p.attempts,
      timeSpentSeconds: p.timeSpentSeconds,
      solvedAt: p.solvedAt,
      lastAttemptedAt: p.lastAttemptedAt,
    })),
    roadmap: {
      totalProblems: roadmapTotal,
      solved: roadmapSolved,
      percentage: roadmapTotal > 0 ? Math.round((roadmapSolved / roadmapTotal) * 100) : 0,
      chapters: roadmapChapterDTOs,
    },
  };
}
