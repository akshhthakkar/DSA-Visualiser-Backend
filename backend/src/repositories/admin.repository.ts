// src/repositories/admin.repository.ts
// Data access layer for admin user management — Phase 5.
// Justification: implementation-roadmap.md Step 5.3
//
// Functional style (consistent with teacher.repository.ts).
// Uses singleton prisma from config/database.ts.
//
// Design decisions:
//   - Page-based pagination: skip = (page - 1) * limit, take = limit
//   - All queries filter deletedAt: null (soft delete exclusion)
//   - Never return passwordHash in user queries (use select)
//   - Search filters: case-insensitive name/email contains
//   - Stats endpoint TODO: Cache in Redis (60s TTL) — Phase 5+ optimization

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import type { ListUsersFilters } from '../types/admin.types.js';

// Safe user select (excludes passwordHash)
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  emailVerified: true,
  emailVerifiedAt: true,
  loginCount: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: false, // Explicitly exclude
  passwordHash: false, // Never return password hash
};

// ============================================
// LIST USERS WITH PAGINATION & FILTERS
// ============================================
export async function listUsers(page: number, limit: number, filters?: ListUsersFilters) {
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    deletedAt: null, // Exclude soft-deleted users
  };

  if (filters?.role) {
    where.role = filters.role;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      loginCount: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take: limit,
  });
}

// ============================================
// COUNT USERS (for pagination)
// ============================================
export async function countUsers(filters?: ListUsersFilters) {
  // Build same where clause as listUsers
  const where: any = {
    deletedAt: null,
  };

  if (filters?.role) {
    where.role = filters.role;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.user.count({ where });
}

// ============================================
// FIND USER BY ID (with student/teacher data)
// ============================================
export async function findById(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null, // Exclude soft-deleted
    },
    select: {
      ...safeUserSelect,
      student: {
        select: {
          registerNumber: true,
          degree: true,
          batch: true,
          university: {
            select: {
              name: true,
            },
          },
        },
      },
      teacher: {
        select: {
          department: true,
          university: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  return user;
}

// ============================================
// UPDATE USER
// ============================================
export async function updateUser(
  userId: string,
  data: {
    name?: string;
    isActive?: boolean;
    emailVerified?: boolean;
  }
) {
  // Update with timestamp
  const updateData: any = { ...data };

  // If emailVerified is being set to true and wasn't already, set timestamp
  if (data.emailVerified === true) {
    updateData.emailVerifiedAt = new Date();
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: safeUserSelect,
  });
}

// ============================================
// CHANGE USER ROLE
// ============================================
export async function changeRole(
  userId: string,
  role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN'
) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
    select: safeUserSelect,
  });
}

// ============================================
// SOFT DELETE USER
// ============================================
export async function softDeleteUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      isActive: false, // Also deactivate to prevent login
    },
  });
}

// ============================================
// GET USER STATISTICS
// TODO: Cache in Redis (60s TTL) — Phase 5+ optimization
// ============================================
export async function getUserStats() {
  // Get counts by role
  const byRole = await prisma.user.groupBy({
    by: ['role'],
    _count: true,
    where: {
      deletedAt: null,
    },
  });

  // Get active/inactive counts
  const activeCount = await prisma.user.count({
    where: {
      deletedAt: null,
      isActive: true,
    },
  });

  const totalCount = await prisma.user.count({
    where: {
      deletedAt: null,
    },
  });

  return {
    byRole,
    activeCount,
    inactiveCount: totalCount - activeCount,
    totalCount,
  };
}

// ============================================
// CLASS MANAGEMENT (Phase 6)
// ============================================

// Transaction isolation: READ COMMITTED (Postgres default).
// Prevents dirty reads, allows non-repeatable reads and phantom reads.
// Sufficient for our use case with partial unique index.

// Safe class select (includes necessary relations)
const safeClassSelect = {
  id: true,
  name: true,
  code: true,
  degree: true,
  batch: true,
  universityId: true,
  primaryTeacherId: true,
  semester: true,
  academicYear: true,
  startDate: true,
  endDate: true,
  maxStudents: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
};

/**
 * Get all classes with optional filtering and pagination.
 * Returns null checks - service layer interprets results.
 * TODO: Replace skip/take with cursor-based pagination when classes exceed 10k records.
 * Current approach causes performance degradation on large offsets.
 */
export async function getAllClasses(filters?: {
  page?: number;
  limit?: number;
  universityId?: string;
  degree?: string;
  batch?: string;
  isActive?: boolean;
  search?: string;
}) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {
    deletedAt: null, // Exclude soft-deleted classes
  };

  if (filters?.universityId) {
    where.universityId = filters.universityId;
  }

  if (filters?.degree) {
    where.degree = { contains: filters.degree, mode: 'insensitive' as const };
  }

  if (filters?.batch) {
    where.batch = filters.batch;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' as const } },
      { code: { contains: filters.search, mode: 'insensitive' as const } },
    ];
  }

  // Fetch classes and total count in parallel
  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: limit,
      select: {
        ...safeClassSelect,
        university: {
          select: {
            id: true,
            name: true,
          },
        },
        primaryTeacher: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
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
    }),
    prisma.class.count({ where }),
  ]);

  return { classes, total };
}

/**
 * Get a single class by ID with full details.
 * Returns null if not found - service layer handles error.
 */
export async function getClassById(id: string) {
  const classData = await prisma.class.findFirst({
    where: {
      id,
      deletedAt: null, // Exclude soft-deleted
    },
    select: {
      ...safeClassSelect,
      university: true,
      primaryTeacher: {
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      enrollments: {
        select: {
          studentId: true,
          enrolledAt: true,
          student: {
            select: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });

  return classData; // null if not found
}

/**
 * Create a new class with validation in transaction.
 * Returns result object: { success: true, class } or { success: false, error, details? }
 * Repository stays data-layer - service interprets validation results.
 */
export async function createClass(data: {
  name: string;
  code: string;
  degree: string;
  batch: string;
  universityId: string;
  primaryTeacherId: string;
  semester?: string;
  academicYear?: string;
  startDate?: Date;
  endDate?: Date;
  maxStudents?: number;
}) {
  const maxTransactionAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Step 1: Validate university exists
          const university = await tx.university.findUnique({
            where: { id: data.universityId },
          });

          if (!university) {
            return {
              success: false as const,
              error: 'UNIVERSITY_NOT_FOUND',
              details: { universityId: data.universityId },
            };
          }

          // Step 2: Validate teacher exists
          const teacher = await tx.teacher.findUnique({
            where: { userId: data.primaryTeacherId },
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          });

          if (!teacher) {
            return {
              success: false as const,
              error: 'TEACHER_NOT_FOUND',
              details: { teacherId: data.primaryTeacherId },
            };
          }

          // Step 3: Validate teacher belongs to same university
          if (teacher.universityId !== data.universityId) {
            return {
              success: false as const,
              error: 'TEACHER_UNIVERSITY_MISMATCH',
              details: {
                teacherUniversityId: teacher.universityId,
                classUniversityId: data.universityId,
              },
            };
          }

          // Step 4: Create class
          const newClass = await tx.class.create({
            data: {
              name: data.name,
              code: data.code,
              degree: data.degree,
              batch: data.batch,
              universityId: data.universityId,
              primaryTeacherId: data.primaryTeacherId,
              semester: data.semester,
              academicYear: data.academicYear,
              startDate: data.startDate,
              endDate: data.endDate,
              maxStudents: data.maxStudents,
            },
            select: {
              ...safeClassSelect,
              university: {
                select: { id: true, name: true },
              },
              primaryTeacher: {
                select: {
                  userId: true,
                  user: {
                    select: { name: true, email: true },
                  },
                },
              },
              _count: {
                select: { enrollments: true },
              },
            },
          });

          return { success: true as const, class: newClass };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 10000,
          timeout: 15000,
        }
      );

      return result;
    } catch (error: any) {
      // Handle Prisma unique constraint violations (P2002)
      if (error?.code === 'P2002') {
        return {
          success: false as const,
          error: 'DUPLICATE_CLASS_CODE',
          details: { code: data.code, universityId: data.universityId },
        };
      }

      const isRetryableTxError = error?.code === 'P2028' || error?.code === 'P2034';
      if (isRetryableTxError && attempt < maxTransactionAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }

      lastError = error;
      break;
    }
  }

  throw lastError;
}

/**
 * Update a class's mutable fields.
 * Returns null if class not found or soft-deleted.
 */
export async function updateClass(
  id: string,
  data: {
    name?: string;
    semester?: string;
    academicYear?: string;
    startDate?: Date;
    endDate?: Date;
    maxStudents?: number;
    isActive?: boolean;
  }
) {
  // Check if class exists and not deleted
  const existingClass = await prisma.class.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClass) {
    return null; // Service layer handles error
  }

  // Update class
  const updatedClass = await prisma.class.update({
    where: { id },
    data,
    select: {
      ...safeClassSelect,
      university: {
        select: { id: true, name: true },
      },
      primaryTeacher: {
        select: {
          userId: true,
          user: {
            select: { name: true, email: true },
          },
        },
      },
      _count: {
        select: { enrollments: true },
      },
    },
  });

  return updatedClass;
}

/**
 * Assign a teacher to a class with validation.
 * Returns result object: { success: true, class } or { success: false, error }
 * TODO: Replace single primaryTeacherId with class_teachers junction table
 * when co-teaching support is implemented. Requires schema migration and API versioning.
 */
export async function assignTeacher(classId: string, teacherId: string) {
  const maxTransactionAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Step 1: Find class
          const classData = await tx.class.findFirst({
            where: { id: classId, deletedAt: null },
            select: { id: true, universityId: true },
          });

          if (!classData) {
            return {
              success: false as const,
              error: 'CLASS_NOT_FOUND',
            };
          }

          // Step 2: Find teacher
          const teacher = await tx.teacher.findUnique({
            where: { userId: teacherId },
            select: { userId: true, universityId: true },
          });

          if (!teacher) {
            return {
              success: false as const,
              error: 'TEACHER_NOT_FOUND',
            };
          }

          // Step 3: Validate university match
          if (teacher.universityId !== classData.universityId) {
            return {
              success: false as const,
              error: 'TEACHER_UNIVERSITY_MISMATCH',
              details: {
                teacherUniversityId: teacher.universityId,
                classUniversityId: classData.universityId,
              },
            };
          }

          // Step 4: Update class
          const updatedClass = await tx.class.update({
            where: { id: classId },
            data: { primaryTeacherId: teacherId },
            select: {
              ...safeClassSelect,
              university: {
                select: { id: true, name: true },
              },
              primaryTeacher: {
                select: {
                  userId: true,
                  user: {
                    select: { name: true, email: true },
                  },
                },
              },
              _count: {
                select: { enrollments: true },
              },
            },
          });

          return { success: true as const, class: updatedClass };
        },
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 10000,
          timeout: 15000,
        }
      );

      return result;
    } catch (error: any) {
      const isRetryableTxError = error?.code === 'P2028' || error?.code === 'P2034';
      if (isRetryableTxError && attempt < maxTransactionAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }

      lastError = error;
      break;
    }
  }

  throw lastError;
}

/**
 * Get class by ID including deleted classes (for delete operation validation).
 * Returns null if not found - service layer handles error.
 * @param id - Class UUID
 * @returns Class with deletedAt field or null
 */
export async function getClassByIdIncludingDeleted(id: string) {
  const classData = await prisma.class.findUnique({
    where: { id },
    select: {
      id: true,
      universityId: true,
      deletedAt: true,
    },
  });

  return classData;
}

/**
 * Soft delete a class by setting deletedAt timestamp.
 * Returns null if class not found or already deleted.
 */
export async function softDeleteClass(id: string) {
  // Check if class exists and not already deleted
  const existingClass = await prisma.class.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existingClass) {
    return null; // Service layer handles specific error
  }

  // Soft delete by setting deletedAt
  const deletedClass = await prisma.class.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: safeClassSelect,
  });

  return deletedClass;
}

/**
 * Get class statistics for admin dashboard.
 * All counts exclude soft-deleted classes.
 */
export async function getClassStats() {
  // All queries filter out soft-deleted classes
  const where = { deletedAt: null };

  const [total, active, byDegree] = await Promise.all([
    prisma.class.count({ where }),
    prisma.class.count({ where: { ...where, isActive: true } }),
    prisma.class.groupBy({
      by: ['degree'],
      where,
      _count: true,
    }),
  ]);

  // Transform groupBy result to Record<string, number>
  const degreeStats = byDegree.reduce(
    (acc, item) => {
      acc[item.degree] = item._count;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    total,
    active,
    byDegree: degreeStats,
  };
}

/**
 * Get audit logs with pagination and optional filters.
 */
export async function getAuditLogs(
  page: number,
  limit: number,
  filters?: { userId?: string; eventType?: string }
) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.eventType) where.eventType = { contains: filters.eventType, mode: 'insensitive' };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        eventType: true,
        resourceType: true,
        resourceId: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        userId: true,
        user: {
          select: { name: true, email: true, role: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
