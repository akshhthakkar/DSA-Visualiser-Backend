// src/types/admin.types.ts
// Zod validation schemas + DTO interfaces for admin user management — Phase 5.
// Justification: implementation-roadmap.md Step 5.2
//
// Design decisions:
//   - Page-based pagination (not cursor): simpler for admin UI, matches roadmap spec
//   - SUPER_ADMIN role protected at service layer (not in Zod schema)
//   - Search filters: name/email contains (case-insensitive)
//   - All mutations require explicit validation (no partial updates without schema)

import { z } from 'zod';

// ============================================
// PARAM SCHEMAS
// ============================================
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// ============================================
// LIST USERS QUERY — GET /api/admin/users?page=&limit=&role=&isActive=&search=
// ============================================
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(10).max(100).default(50).optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export interface ListUsersFilters {
  role?: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
  search?: string;
}

// ============================================
// UPDATE USER — PUT /api/admin/users/:id
// ============================================
export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================
// CHANGE ROLE — PUT /api/admin/users/:id/role
// ============================================
export const changeRoleSchema = z.object({
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

// ============================================
// RESPONSE DTOs
// ============================================
export interface UserListItemDTO {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  loginCount: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserDetailDTO extends UserListItemDTO {
  emailVerifiedAt: Date | null;
  updatedAt: Date;
  student: {
    registerNumber: string;
    degree: string;
    batch: string;
    universityName: string;
  } | null;
  teacher: {
    department: string | null;
    universityName: string;
  } | null;
}

export interface UserStatsDTO {
  total: number;
  active: number;
  inactive: number;
  byRole: {
    STUDENT: number;
    TEACHER: number;
    ADMIN: number;
    SUPER_ADMIN: number;
  };
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserListResponseDTO {
  users: UserListItemDTO[];
  pagination: PaginationDTO;
}
