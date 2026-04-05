// src/types/teacher.types.ts
// Zod validation schemas + DTO interfaces for teacher class management — Phase 4.
// Justification: implementation-roadmap.md Step 4.1
//
// Design decisions:
//   - getClass uses findFirst with combined ownership+soft-delete filter (no findUnique).
//   - Student progress access: teacher can view any student enrolled in their classes.
//     Future refinement: scope to class via GET /classes/:classId/students/:studentId/progress
//     when co-teaching is added.
//   - Pagination shape reserved (limit/cursor) on student list, defaults to limit=100.

import { z } from 'zod';

// ============================================
// PARAM SCHEMAS
// ============================================
export const classIdParamSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
});

export const studentIdParamSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
});

// ============================================
// ADD STUDENT — POST /api/teacher/classes/:classId/students
// ============================================
export const addStudentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
});

export type AddStudentInput = z.infer<typeof addStudentSchema>;

// ============================================
// CREATE CLASS — POST /api/teacher/classes
// ============================================
export const createTeacherClassSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    code: z
      .string()
      .min(2, 'Code must be at least 2 characters')
      .max(50)
      .regex(/^[A-Z0-9-]+$/i, 'Code must be alphanumeric with hyphens only'),
    degree: z.string().min(2).max(100),
    batch: z.string().min(4, 'Batch must be at least 4 characters (e.g., 2024)').max(50),
    semester: z.string().max(20).optional(),
    academicYear: z
      .string()
      .max(10)
      .regex(/^\d{4}(-\d{4})?$/, 'Academic year must be YYYY or YYYY-YYYY')
      .optional(),
    startDate: z.string().datetime('Must be valid ISO 8601 datetime').optional(),
    endDate: z.string().datetime('Must be valid ISO 8601 datetime').optional(),
    maxStudents: z.number().int().min(1, 'Must have at least 1 student').max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'INVALID_DATE_RANGE',
      path: ['endDate'],
    }
  );

export type CreateTeacherClassInput = z.infer<typeof createTeacherClassSchema>;

// ============================================
// STUDENT LIST QUERY — GET /api/teacher/classes/:classId/students?limit=&cursor=
// ============================================
export const studentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100).optional(),
  cursor: z.string().uuid('Invalid cursor').optional(),
});

// ============================================
// SEARCH STUDENTS — GET /api/teacher/classes/:classId/search-students?q=
// Searches students from teacher's university NOT already enrolled.
// ============================================
export const searchStudentsQuerySchema = z.object({
  q: z.string().min(1, 'Search query required').max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10).optional(),
});

export type SearchStudentsQuery = z.infer<typeof searchStudentsQuerySchema>;

export interface SearchStudentResultDTO {
  userId: string;
  name: string;
  email: string;
  registerNumber: string;
  degree: string;
  batch: string;
}

export type StudentListQuery = z.infer<typeof studentListQuerySchema>;

// ============================================
// RESPONSE DTOs
// ============================================
export interface TeacherProfileDTO {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  university: {
    id: string;
    name: string;
  };
}

export interface ClassListItemDTO {
  id: string;
  name: string;
  code: string;
  degree: string;
  batch: string;
  semester: string | null;
  academicYear: string | null;
  universityName: string;
  studentCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface ClassDetailDTO extends ClassListItemDTO {
  maxStudents: number;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ClassStudentDTO {
  userId: string;
  name: string;
  email: string;
  registerNumber: string;
  degree: string;
  batch: string;
  enrolledAt: Date;
}

export interface RoadmapProblemProgressDTO {
  id: string;
  title: string;
  difficulty: string;
  topic: string;
  status: string;
  solvedAt: Date | null;
}

export interface RoadmapChapterProgressDTO {
  id: string;
  title: string;
  order: number;
  totalProblems: number;
  solvedCount: number;
  problems: RoadmapProblemProgressDTO[];
}

export interface StudentProgressViewDTO {
  student: {
    userId: string;
    name: string;
    email: string;
    registerNumber: string;
  };
  summary: {
    totalProblems: number;
    notStarted: number;
    inProgress: number;
    attempted: number;
    solved: number;
  };
  progress: Array<{
    problemId: string;
    problemTitle: string;
    difficulty: string;
    topic: string;
    status: string;
    attempts: number;
    timeSpentSeconds: number;
    solvedAt: Date | null;
    lastAttemptedAt: Date | null;
  }>;
  roadmap: {
    totalProblems: number;
    solved: number;
    percentage: number;
    chapters: RoadmapChapterProgressDTO[];
  };
}
