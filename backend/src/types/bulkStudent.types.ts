// src/types/bulkStudent.types.ts
// Zod validation schemas + DTO interfaces for bulk student creation.
// Follows functional style and conventions from admin.types.ts.

import { z } from 'zod';

// ============================================
// SINGLE STUDENT ROW SCHEMA
// ============================================
export const studentImportSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  registerNumber: z.string().min(1, 'Register number is required').max(50),
  degree: z.string().min(1, 'Degree is required').max(100),
  batch: z.string().min(4, 'Batch must be at least 4 characters').max(50),
  password: z.string().min(8).optional(),
});

export type StudentImportData = z.infer<typeof studentImportSchema>;

// ============================================
// JSON BULK CREATE BODY SCHEMA
// universityId is optional — derived from admin's profile when available.
// SUPER_ADMIN may override by passing it explicitly.
// ============================================
export const bulkCreateJsonSchema = z.object({
  students: z
    .array(studentImportSchema)
    .min(1, 'At least one student is required')
    .max(500, 'Maximum 500 students per request'),
  universityId: z.string().uuid('Invalid university ID').optional(),
});

export type BulkCreateJsonInput = z.infer<typeof bulkCreateJsonSchema>;

// ============================================
// RESULT DTOs
// ============================================
export interface BulkCreateFailedRow {
  row: number;
  data: StudentImportData;
  error: string;
}

export interface BulkCreateSummary {
  total: number;
  successful: number;
  failed: number;
}

export interface BulkCreateResult {
  success: (StudentImportData & { password: string })[];
  failed: BulkCreateFailedRow[];
  summary: BulkCreateSummary;
  mustResetPassword: true;
}

// ============================================
// VALIDATION-ONLY RESULT (no DB writes)
// ============================================
export interface BulkValidationResult {
  valid: (StudentImportData & { row: number })[];
  invalid: BulkCreateFailedRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}
