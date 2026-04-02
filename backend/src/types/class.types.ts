// src/types/class.types.ts
// Type definitions and validation schemas for class management — Phase 6.
// Justification: implementation-roadmap.md Phase 6
//
// DTOs provide stable API contracts independent of database schema.
// Platform-wide pagination standard ensures frontend consistency.
// Immutable fields (universityId, code) enforced at service layer.

import { z } from 'zod';

// ============================================
// PAGINATION DTO (Platform-wide Standard)
// ============================================

/**
 * Platform-wide standard pagination shape.
 * Used across all paginated endpoints for frontend consistency.
 * Includes hasNext/hasPrev for efficient UI rendering.
 */
export interface PaginationMetaDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// CLASS DTOs
// ============================================

/**
 * Lightweight class item for list endpoints.
 * Optimized for displaying class cards/tables.
 */
export interface ClassListItemDTO {
  id: string;
  name: string;
  code: string;
  degree: string;
  batch: string;
  university: {
    id: string;
    name: string;
  };
  primaryTeacher: {
    userId: string;
    name: string;
    email: string;
  };
  enrollmentCount: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

/**
 * Detailed class information including enrollments.
 * Used for single class view and management.
 */
export interface ClassDetailDTO extends ClassListItemDTO {
  semester: string | null;
  academicYear: string | null;
  maxStudents: number;
  updatedAt: Date;
  enrollments: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    enrolledAt: Date;
  }>;
}

/**
 * Class statistics for admin dashboard.
 * lastComputedAt prepares for future Redis caching.
 */
export interface ClassStatsDTO {
  total: number;
  active: number;
  inactive: number;
  byDegree: Record<string, number>;
  lastComputedAt: Date;
}

/**
 * Paginated response for class list endpoint.
 */
export interface PaginatedClassesResponseDTO {
  classes: ClassListItemDTO[];
  pagination: PaginationMetaDTO;
}

// ============================================
// ERROR CODES (Specific, Not Generic)
// ============================================

/**
 * Custom error codes for class operations.
 * Provides specific feedback to frontend for better UX.
 */
export const CLASS_ERROR_CODES = {
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  UNIVERSITY_NOT_FOUND: 'UNIVERSITY_NOT_FOUND',
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  TEACHER_UNIVERSITY_MISMATCH: 'TEACHER_UNIVERSITY_MISMATCH',
  CLASS_ALREADY_DELETED: 'CLASS_ALREADY_DELETED',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  DUPLICATE_CLASS_CODE: 'DUPLICATE_CLASS_CODE',
  IMMUTABLE_FIELD_CHANGE: 'IMMUTABLE_FIELD_CHANGE',
} as const;

// ============================================
// VALIDATION SCHEMAS (Zod)
// ============================================

/**
 * Query parameters for listing classes.
 * All parameters optional for flexible filtering.
 */
export const listClassesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  universityId: z.string().uuid().optional(),
  degree: z.string().min(1).max(100).optional(),
  batch: z.string().min(1).max(50).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().min(1).max(255).optional(),
});

/**
 * Schema for creating a new class.
 * Enforces date logic: endDate must be after startDate.
 */
export const createClassSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(255),
    code: z
      .string()
      .min(2, 'Code must be at least 2 characters')
      .max(50)
      .regex(/^[A-Z0-9-]+$/i, 'Code must be alphanumeric with hyphens only'),
    degree: z.string().min(2).max(100),
    batch: z.string().min(4, 'Batch must be at least 4 characters (e.g., 2024)').max(50),
    universityId: z.string().uuid('Invalid university ID'),
    primaryTeacherId: z.string().uuid('Invalid teacher ID'),
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
      message: CLASS_ERROR_CODES.INVALID_DATE_RANGE,
      path: ['endDate'],
    }
  );

/**
 * Schema for updating a class.
 * CRITICAL: Excludes universityId and code (immutable fields).
 * Service layer enforces immutability as additional safeguard.
 */
export const updateClassSchema = z
  .object({
    name: z.string().min(2).max(255).optional(),
    semester: z.string().max(20).optional(),
    academicYear: z
      .string()
      .max(10)
      .regex(/^\d{4}(-\d{4})?$/, 'Academic year must be YYYY or YYYY-YYYY')
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    maxStudents: z.number().int().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .strict() // Reject unknown fields including immutable ones
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    {
      message: CLASS_ERROR_CODES.INVALID_DATE_RANGE,
      path: ['endDate'],
    }
  );

/**
 * Schema for assigning a teacher to a class.
 */
export const assignTeacherSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID'),
});

/**
 * Schema for class ID parameter validation.
 */
export const classIdParamSchema = z.object({
  id: z.string().uuid('Invalid class ID'),
});

// ============================================
// INFERRED TYPES FOR SERVICE LAYER
// ============================================

export type ListClassesFilters = z.infer<typeof listClassesQuerySchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type ClassIdParam = z.infer<typeof classIdParamSchema>;
