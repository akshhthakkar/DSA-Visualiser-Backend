// src/services/admin.service.ts
// Business logic for admin user management — Phase 5.
// Justification: implementation-roadmap.md Step 5.4
//
// Functional style. Services return explicit DTOs, never raw Prisma shapes.
// CRITICAL security: SUPER_ADMIN users cannot be modified/deleted by admins.
//
// Protection layers:
//   1. Self-action prevention: admins cannot modify their own account
//   2. SUPER_ADMIN protection: admins cannot update/delete/change role of SUPER_ADMIN users
//   3. SUPER_ADMIN assignment blocked: only database seed can create SUPER_ADMIN
//   4. Non-blocking audit: all actions logged, failures don't break operations

import * as adminRepo from '../repositories/admin.repository.js';
import * as auditService from './audit.service.js';
import { logger } from '../config/logger.js';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';
import type {
  UserListResponseDTO,
  UserDetailDTO,
  UserStatsDTO,
  ListUsersFilters,
  UpdateUserInput,
} from '../types/admin.types.js';
import type {
  ClassListItemDTO,
  ClassDetailDTO,
  ClassStatsDTO,
  PaginatedClassesResponseDTO,
  PaginationMetaDTO,
  ListClassesFilters,
  CreateClassInput,
  UpdateClassInput,
} from '../types/class.types.js';
import { CLASS_ERROR_CODES } from '../types/class.types.js';

// ============================================
// HELPER: VALIDATE NOT SUPER_ADMIN
// ============================================
function validateNotSuperAdmin(user: { role: string }): void {
  if (user.role === 'SUPER_ADMIN') {
    throw new AuthorizationError('Cannot modify SUPER_ADMIN users');
  }
}

// ============================================
// HELPER: VALIDATE NOT SELF
// ============================================
function validateNotSelf(userId: string, adminId: string): void {
  if (userId === adminId) {
    throw new ValidationError('Cannot modify your own account');
  }
}

// ============================================
// LIST USERS WITH PAGINATION
// ============================================
export async function listUsers(
  page: number,
  limit: number,
  filters: ListUsersFilters,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<UserListResponseDTO> {
  // Fetch users and total count in parallel
  const [users, total] = await Promise.all([
    adminRepo.listUsers(page, limit, filters),
    adminRepo.countUsers(filters),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_LIST_USERS', null, adminId, ip, userAgent, {
      filters,
      page,
      limit,
    })
    .catch((err) => logger.error(err));

  return {
    users: users.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      emailVerified: u.emailVerified,
      loginCount: u.loginCount,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

// ============================================
// GET USER BY ID
// ============================================
export async function getUserById(
  userId: string,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<UserDetailDTO> {
  const user = await adminRepo.findById(userId);

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_VIEW_USER', userId, adminId, ip, userAgent)
    .catch((err) => logger.error(err));

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    loginCount: user.loginCount,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    student: user.student
      ? {
          registerNumber: user.student.registerNumber,
          degree: user.student.degree,
          batch: user.student.batch,
          universityName: user.student.university.name,
        }
      : null,
    teacher: user.teacher
      ? {
          department: user.teacher.department,
          universityName: user.teacher.university.name,
        }
      : null,
  };
}

// ============================================
// UPDATE USER
// ============================================
export async function updateUser(
  userId: string,
  data: UpdateUserInput,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<UserDetailDTO> {
  // Fetch current user for validation
  const currentUser = await adminRepo.findById(userId);

  // CRITICAL: Check self-modification before SUPER_ADMIN check (better UX)
  validateNotSelf(userId, adminId);

  // CRITICAL: Prevent modifying SUPER_ADMIN users
  validateNotSuperAdmin(currentUser);

  // Perform update
  await adminRepo.updateUser(userId, data);

  // Log action with changed fields (non-blocking)
  auditService
    .logAdminAction('ADMIN_UPDATE_USER', userId, adminId, ip, userAgent, {
      changedFields: Object.keys(data),
    })
    .catch((err) => logger.error(err));

  // Return full detail DTO
  return getUserById(userId, adminId, ip, userAgent);
}

// ============================================
// CHANGE USER ROLE
// ============================================
export async function changeRole(
  userId: string,
  role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN',
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<UserDetailDTO> {
  // CRITICAL: Cannot assign SUPER_ADMIN role
  if (role === 'SUPER_ADMIN') {
    throw new ValidationError('Cannot assign SUPER_ADMIN role');
  }

  // Fetch current user for validation
  const currentUser = await adminRepo.findById(userId);

  // CRITICAL: Check self-modification before SUPER_ADMIN check
  validateNotSelf(userId, adminId);

  // CRITICAL: Prevent changing SUPER_ADMIN user's role
  validateNotSuperAdmin(currentUser);

  const oldRole = currentUser.role;

  // Perform role change
  await adminRepo.changeRole(userId, role);

  // Log action with old/new role (non-blocking)
  auditService
    .logAdminAction('ADMIN_CHANGE_ROLE', userId, adminId, ip, userAgent, {
      oldRole,
      newRole: role,
    })
    .catch((err) => logger.error(err));

  // Return full detail DTO
  return getUserById(userId, adminId, ip, userAgent);
}

// ============================================
// DELETE USER (soft delete)
// ============================================
export async function deleteUser(
  userId: string,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<void> {
  // Fetch current user for validation
  const currentUser = await adminRepo.findById(userId);

  // CRITICAL: Check self-modification before SUPER_ADMIN check
  validateNotSelf(userId, adminId);

  // CRITICAL: Prevent deleting SUPER_ADMIN users
  validateNotSuperAdmin(currentUser);

  // Perform soft delete
  await adminRepo.softDeleteUser(userId);

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_DELETE_USER', userId, adminId, ip, userAgent)
    .catch((err) => logger.error(err));
}

// ============================================
// GET USER STATISTICS
// ============================================
export async function getStats(
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<UserStatsDTO> {
  const stats = await adminRepo.getUserStats();

  // Transform to DTO format
  const byRole: UserStatsDTO['byRole'] = {
    STUDENT: 0,
    TEACHER: 0,
    ADMIN: 0,
    SUPER_ADMIN: 0,
  };

  for (const item of stats.byRole) {
    byRole[item.role as keyof typeof byRole] = item._count;
  }

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_GET_STATS', null, adminId, ip, userAgent)
    .catch((err) => logger.error(err));

  return {
    total: stats.totalCount,
    active: stats.activeCount,
    inactive: stats.inactiveCount,
    byRole,
  };
}

// ============================================
// CLASS MANAGEMENT (Phase 6)
// ============================================

// Immutable fields - cannot be changed after class creation
const IMMUTABLE_FIELDS = ['universityId', 'code'] as const;

/**
 * Validate that update data doesn't contain immutable fields.
 * Throws ValidationError if immutable field detected.
 */
function validateImmutableFields(updateData: any): void {
  for (const field of IMMUTABLE_FIELDS) {
    if (field in updateData) {
      throw new ValidationError(
        `Cannot modify immutable field: ${field}`,
        CLASS_ERROR_CODES.IMMUTABLE_FIELD_CHANGE
      );
    }
  }
}

/**
 * Map raw class data from repository to ClassListItemDTO.
 * Calculates enrollment count from _count aggregate.
 */
function mapToClassListDTO(rawClass: any): ClassListItemDTO {
  return {
    id: rawClass.id,
    name: rawClass.name,
    code: rawClass.code,
    degree: rawClass.degree,
    batch: rawClass.batch,
    university: {
      id: rawClass.university.id,
      name: rawClass.university.name,
    },
    primaryTeacher: {
      userId: rawClass.primaryTeacher.userId,
      name: rawClass.primaryTeacher.user.name,
      email: rawClass.primaryTeacher.user.email,
    },
    enrollmentCount: rawClass._count.enrollments,
    isActive: rawClass.isActive,
    startDate: rawClass.startDate,
    endDate: rawClass.endDate,
    createdAt: rawClass.createdAt,
  };
}

/**
 * Map raw class data with enrollments to ClassDetailDTO.
 * Extends list mapping with detail fields.
 */
function mapToClassDetailDTO(rawClass: any): ClassDetailDTO {
  const baseDTO = mapToClassListDTO(rawClass);

  return {
    ...baseDTO,
    semester: rawClass.semester,
    academicYear: rawClass.academicYear,
    maxStudents: rawClass.maxStudents,
    updatedAt: rawClass.updatedAt,
    enrollments: rawClass.enrollments
      ? rawClass.enrollments.map((enrollment: any) => ({
          studentId: enrollment.studentId,
          studentName: enrollment.student.user.name,
          studentEmail: enrollment.student.user.email,
          enrolledAt: enrollment.enrolledAt,
        }))
      : [],
  };
}

/**
 * List classes with filters and pagination.
 * Returns paginated response with hasNext/hasPrev indicators.
 */
export async function listClasses(
  filters: ListClassesFilters,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  requestId?: string
): Promise<PaginatedClassesResponseDTO> {
  const { classes, total } = await adminRepo.getAllClasses(filters);

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const totalPages = Math.ceil(total / limit);

  const pagination: PaginationMetaDTO = {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  // Map to DTOs
  const classDTOs = classes.map(mapToClassListDTO);

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_LIST_CLASSES', null, adminId, ip, userAgent, {
      action: 'LIST',
      filters,
      pagination: { page, limit },
      requestId,
    })
    .catch((err) => logger.error(err));

  return {
    classes: classDTOs,
    pagination,
  };
}

/**
 * Get a single class by ID with full details.
 * Enforces university-scoped authorization.
 */
export async function getClassById(
  id: string,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  adminUniversityId: string,
  requestId?: string
): Promise<ClassDetailDTO> {
  const classData = await adminRepo.getClassById(id);

  if (!classData) {
    throw new NotFoundError('Class');
  }

  // University-scoped authorization
  // Even for single-tenant deployments, enforce this for future multi-tenant migration
  if (classData.universityId !== adminUniversityId) {
    throw new AuthorizationError(
      'University scope violation: Cannot access class from different university'
    );
  }

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_VIEW_CLASS', id, adminId, ip, userAgent, {
      action: 'VIEW',
      resourceId: id,
      requestId,
    })
    .catch((err) => logger.error(err));

  return mapToClassDetailDTO(classData);
}

/**
 * Create a new class with validation.
 * Enforces university-scoped authorization and handles repository validation results.
 */
export async function createClass(
  data: CreateClassInput,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  adminUniversityId: string,
  requestId?: string
): Promise<ClassDetailDTO> {
  // University-scoped authorization
  // Admin can only create classes in their own university
  // SUPER_ADMIN (adminUniversityId === '*') bypasses scope check
  if (adminUniversityId !== '*' && data.universityId !== adminUniversityId) {
    throw new AuthorizationError(
      'University scope violation: Cannot create class in different university'
    );
  }

  // Convert date strings to Date objects
  const createData = {
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
  };

  // Call repository (returns validation result)
  const result = await adminRepo.createClass(createData);

  // Handle validation errors from repository
  if (!result.success) {
    if (result.error === 'UNIVERSITY_NOT_FOUND') {
      throw new NotFoundError('University');
    }
    if (result.error === 'TEACHER_NOT_FOUND') {
      throw new NotFoundError('Teacher');
    }
    if (result.error === 'TEACHER_UNIVERSITY_MISMATCH') {
      throw new ConflictError('Teacher must belong to the same university as the class');
    }
    if (result.error === 'DUPLICATE_CLASS_CODE') {
      throw new ConflictError('Class code already exists in this university');
    }
    throw new Error(`Unexpected repository error: ${result.error}`);
  }

  const createdClass = result.class;

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_CREATE_CLASS', createdClass.id, adminId, ip, userAgent, {
      action: 'CREATE',
      after: {
        classId: createdClass.id,
        name: createdClass.name,
        code: createdClass.code,
        universityId: createdClass.universityId,
      },
      context: { adminUniversityId },
      requestId,
    })
    .catch((err) => logger.error(err));

  return mapToClassDetailDTO(createdClass);
}

/**
 * Update a class's mutable fields.
 * Validates immutability and enforces university scope.
 */
export async function updateClass(
  id: string,
  data: UpdateClassInput,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  adminUniversityId: string,
  requestId?: string
): Promise<ClassDetailDTO> {
  // Validate immutable fields not being changed
  validateImmutableFields(data);

  // Fetch existing class for authorization and before-state audit
  const existingClass = await adminRepo.getClassById(id);

  if (!existingClass) {
    throw new NotFoundError('Class');
  }

  // University-scoped authorization
  // SUPER_ADMIN (adminUniversityId === '*') bypasses scope check
  if (adminUniversityId !== '*' && existingClass.universityId !== adminUniversityId) {
    throw new AuthorizationError(
      'University scope violation: Cannot update class from different university'
    );
  }

  // Convert date strings to Date objects
  const updateData = {
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
  };

  // Update class
  const updatedClass = await adminRepo.updateClass(id, updateData);

  if (!updatedClass) {
    throw new NotFoundError('Class');
  }

  // Log action (non-blocking) with before/after
  auditService
    .logAdminAction('ADMIN_UPDATE_CLASS', id, adminId, ip, userAgent, {
      action: 'UPDATE',
      before: {
        name: existingClass.name,
        semester: existingClass.semester,
        isActive: existingClass.isActive,
      },
      after: updateData,
      resourceId: id,
      requestId,
    })
    .catch((err) => logger.error(err));

  return mapToClassDetailDTO(updatedClass);
}

/**
 * Assign a teacher to a class.
 * Enforces university scope and handles repository validation.
 */
export async function assignTeacher(
  classId: string,
  teacherId: string,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  adminUniversityId: string,
  requestId?: string
): Promise<ClassDetailDTO> {
  // Fetch existing class for authorization and before-state audit
  const existingClass = await adminRepo.getClassById(classId);

  if (!existingClass) {
    throw new NotFoundError('Class');
  }

  // University-scoped authorization
  // SUPER_ADMIN (adminUniversityId === '*') bypasses scope check
  if (adminUniversityId !== '*' && existingClass.universityId !== adminUniversityId) {
    throw new AuthorizationError(
      'University scope violation: Cannot assign teacher to class from different university'
    );
  }

  const oldTeacherId = existingClass.primaryTeacherId;

  // Call repository transaction
  const result = await adminRepo.assignTeacher(classId, teacherId);

  // Handle validation errors
  if (!result.success) {
    if (result.error === 'CLASS_NOT_FOUND') {
      throw new NotFoundError('Class');
    }
    if (result.error === 'TEACHER_NOT_FOUND') {
      throw new NotFoundError('Teacher');
    }
    if (result.error === 'TEACHER_UNIVERSITY_MISMATCH') {
      throw new ConflictError('Teacher must belong to the same university as the class');
    }
    throw new Error(`Unexpected repository error: ${result.error}`);
  }

  // Log action (non-blocking) with before/after
  auditService
    .logAdminAction('ADMIN_ASSIGN_TEACHER', classId, adminId, ip, userAgent, {
      action: 'ASSIGN_TEACHER',
      before: { primaryTeacherId: oldTeacherId },
      after: { primaryTeacherId: teacherId },
      context: { universityId: existingClass.universityId },
      requestId,
    })
    .catch((err) => logger.error(err));

  return mapToClassDetailDTO(result.class);
}

/**
 * Soft delete a class by setting deletedAt timestamp.
 * Enforces university scope.
 */
export async function softDeleteClass(
  id: string,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  adminUniversityId: string,
  requestId?: string
): Promise<{ message: string }> {
  // Fetch class for authorization (including deleted ones to check if already deleted)
  const existingClass = await adminRepo.getClassByIdIncludingDeleted(id);

  if (!existingClass) {
    throw new NotFoundError('Class');
  }

  // Check if already deleted - this is a state conflict, not invalid input
  if (existingClass.deletedAt) {
    throw new ConflictError('Class is already deleted');
  }

  // University-scoped authorization
  // SUPER_ADMIN (adminUniversityId === '*') bypasses scope check
  if (adminUniversityId !== '*' && existingClass.universityId !== adminUniversityId) {
    throw new AuthorizationError(
      'University scope violation: Cannot delete class from different university'
    );
  }

  // Perform soft delete
  const deletedClass = await adminRepo.softDeleteClass(id);

  if (!deletedClass) {
    throw new NotFoundError('Class');
  }

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_DELETE_CLASS', id, adminId, ip, userAgent, {
      action: 'SOFT_DELETE',
      resourceId: id,
      requestId,
    })
    .catch((err) => logger.error(err));

  return { message: 'Class deleted successfully' };
}

/**
 * Get class statistics for admin dashboard.
 * TODO: Cache in Redis with 60s TTL. Key: 'class:stats:global'
 * Invalidate on any class mutation. Implement when admin stats queries impact DB performance.
 */
export async function getClassStats(
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  requestId?: string
): Promise<ClassStatsDTO> {
  const stats = await adminRepo.getClassStats();

  // Log action (non-blocking)
  auditService
    .logAdminAction('ADMIN_GET_CLASS_STATS', null, adminId, ip, userAgent, {
      action: 'GET_STATS',
      requestId,
    })
    .catch((err) => logger.error(err));

  return {
    total: stats.total,
    active: stats.active,
    inactive: stats.total - stats.active,
    byDegree: stats.byDegree,
    lastComputedAt: new Date(),
  };
}

// ============================================
// GET AUDIT LOGS
// ============================================
export async function getAuditLogs(
  page: number,
  limit: number,
  filters: { userId?: string; eventType?: string },
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined
) {
  const { logs, total } = await adminRepo.getAuditLogs(page, limit, filters);
  const totalPages = Math.ceil(total / limit);

  auditService
    .logAdminAction('ADMIN_VIEW_AUDIT_LOGS', null, adminId, ip, userAgent, { filters, page, limit })
    .catch((err) => logger.error(err));

  return {
    logs,
    pagination: { page, limit, total, totalPages },
  };
}
