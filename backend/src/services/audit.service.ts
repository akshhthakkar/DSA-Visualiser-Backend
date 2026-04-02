// src/services/audit.service.ts
// Centralized audit logging service — Phase 5.
// Justification: implementation-roadmap.md Step 5.1
//
// Non-blocking: Audit failures NEVER break business operations.
// All functions wrapped in try/catch, errors logged to console.

import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

// ============================================
// LOG ADMIN ACTION
// ============================================
export async function logAdminAction(
  eventType: string,
  resourceId: string | null,
  adminId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        eventType,
        resourceType: 'USER',
        resourceId,
        ipAddress: ip,
        userAgent,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  } catch (error) {
    // CRITICAL: Never throw - audit failures must not block admin operations
    logger.error('[AuditService] Failed to log admin action:', {
      eventType,
      resourceId,
      adminId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

// ============================================
// LOG AUTH EVENT
// ============================================
export async function logAuthEvent(
  eventType: string,
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        eventType,
        resourceType: 'USER',
        resourceId: userId,
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (error) {
    // CRITICAL: Never throw - audit failures must not block auth operations
    logger.error('[AuditService] Failed to log auth event:', {
      eventType,
      userId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
