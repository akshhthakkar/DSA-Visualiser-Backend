// src/services/bulkStudent.service.ts
// Business logic for bulk student creation — security hardened.
// Functional style (consistent with admin.service.ts).
//
// Security measures:
//   1. University scope enforced server-side (derived from admin profile)
//   2. Email domain validation against university's allowed domains
//   3. mustResetPassword = true on all bulk-created accounts
//   4. P2002 (unique constraint) caught per-row for concurrency safety
//   5. CSV injection fields already sanitized by csvParser.ts
//   6. Intra-batch duplicate detection (emails + register numbers)
//   7. Audit log with requestId

import * as bulkStudentRepo from '../repositories/bulkStudent.repository.js';
import * as auditService from './audit.service.js';
import { logger } from '../config/logger.js';
import { sendBulkEmails, SendEmailOptions } from './email.service.js';
import { hashPassword } from '../utils/password.js';
import { studentImportSchema } from '../types/bulkStudent.types.js';
import type {
  StudentImportData,
  BulkCreateResult,
  BulkValidationResult,
} from '../types/bulkStudent.types.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errors.js';
import { randomBytes } from 'node:crypto';

// ============================================
// GENERATE SECURE PASSWORD
// 16-char password with guaranteed complexity.
// ============================================
function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const bytes = randomBytes(16);
  let password = '';
  password += upper[bytes[0]! % upper.length];
  password += lower[bytes[1]! % lower.length];
  password += digits[bytes[2]! % digits.length];
  password += special[bytes[3]! % special.length];

  for (let i = 4; i < 16; i++) {
    password += all[bytes[i]! % all.length];
  }

  return password;
}

// ============================================
// RESOLVE UNIVERSITY ID (server-side enforcement)
// SUPER_ADMIN → may override with body universityId
// ADMIN → must use their profile's university; body ignored
// ============================================
async function resolveUniversityId(
  adminId: string,
  adminRole: string,
  bodyUniversityId: string | undefined
): Promise<string> {
  // Look up admin's own university from Teacher/Student profile
  const profileUniversityId = await bulkStudentRepo.resolveAdminUniversity(adminId);

  if (adminRole === 'SUPER_ADMIN') {
    // SUPER_ADMIN can specify any university, or fall back to profile
    const universityId = bodyUniversityId || profileUniversityId;
    if (!universityId) {
      throw new ValidationError(
        'universityId is required (SUPER_ADMIN without profile must specify it)'
      );
    }
    return universityId;
  }

  // ADMIN — enforce scope. Never trust body.
  if (profileUniversityId) {
    return profileUniversityId;
  }

  // ADMIN without a profile — cannot determine university
  throw new AuthorizationError(
    'Admin account is not associated with any university. Contact a SUPER_ADMIN.'
  );
}

// ============================================
// VALIDATE EMAIL DOMAINS
// If university has emailDomains configured, enforce them.
// ============================================
function validateEmailDomains(
  students: StudentImportData[],
  emailDomains: string[]
): { row: number; data: StudentImportData; error: string }[] {
  if (emailDomains.length === 0) return []; // No domain restriction

  const failures: { row: number; data: StudentImportData; error: string }[] = [];

  for (let i = 0; i < students.length; i++) {
    const student = students[i]!;
    const emailLower = student.email.toLowerCase();
    const matchesDomain = emailDomains.some((domain) =>
      emailLower.endsWith(`@${domain.toLowerCase()}`)
    );

    if (!matchesDomain) {
      failures.push({
        row: i + 2,
        data: student,
        error: `Email domain not allowed. Must end with: ${emailDomains.map((d) => `@${d}`).join(', ')}`,
      });
    }
  }

  return failures;
}

// ============================================
// VALIDATE STUDENTS (dry-run — no DB writes)
// Reuses all validation logic from createStudentsBulk.
// ============================================
export async function validateStudentsBulk(
  students: StudentImportData[],
  bodyUniversityId: string | undefined,
  adminId: string,
  adminRole: string
): Promise<BulkValidationResult> {
  const result: BulkValidationResult = {
    valid: [],
    invalid: [],
    summary: { total: students.length, valid: 0, invalid: 0 },
  };

  // Step 1: Resolve university
  const universityId = await resolveUniversityId(adminId, adminRole, bodyUniversityId);

  // Step 2: Validate university
  const university = await bulkStudentRepo.getUniversityWithDomains(universityId);
  if (!university || !university.isActive) {
    throw new NotFoundError('University');
  }

  // Step 3: Email domain validation
  const domainFailures = validateEmailDomains(students, university.emailDomains);
  if (domainFailures.length > 0) {
    const failedEmails = new Set(domainFailures.map((f) => f.data.email.toLowerCase()));
    result.invalid.push(...domainFailures);
    result.summary.invalid += domainFailures.length;
    students = students.filter((s) => !failedEmails.has(s.email.toLowerCase()));
    if (students.length === 0) return result;
  }

  // Step 4: Check for duplicate emails within batch
  const emails = students.map((s) => s.email.toLowerCase());
  const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
  if (duplicateEmails.length > 0) {
    throw new ValidationError(
      `Duplicate emails in import: ${[...new Set(duplicateEmails)].join(', ')}`
    );
  }

  // Step 5: Check for duplicate register numbers within batch
  const registerNumbers = students.map((s) => s.registerNumber);
  const duplicateRegNums = registerNumbers.filter(
    (rn, index) => registerNumbers.indexOf(rn) !== index
  );
  if (duplicateRegNums.length > 0) {
    throw new ValidationError(
      `Duplicate register numbers in import: ${[...new Set(duplicateRegNums)].join(', ')}`
    );
  }

  // Step 6: Check existing records in database
  const existingEmails = await bulkStudentRepo.findExistingEmails(emails);
  const existingRegNums = await bulkStudentRepo.findExistingRegisterNumbers(
    registerNumbers,
    universityId
  );

  // Step 7: Validate each row
  for (let i = 0; i < students.length; i++) {
    const studentData = students[i]!;
    const rowNumber = i + 2;

    if (existingEmails.has(studentData.email.toLowerCase())) {
      result.invalid.push({
        row: rowNumber,
        data: studentData,
        error: `Email ${studentData.email} already exists`,
      });
      result.summary.invalid++;
      continue;
    }

    if (existingRegNums.has(studentData.registerNumber)) {
      result.invalid.push({
        row: rowNumber,
        data: studentData,
        error: `Register number ${studentData.registerNumber} already exists in this university`,
      });
      result.summary.invalid++;
      continue;
    }

    const validation = studentImportSchema.safeParse(studentData);
    if (!validation.success) {
      const errorMessages = validation.error.issues.map((issue) => issue.message).join(', ');
      result.invalid.push({ row: rowNumber, data: studentData, error: errorMessages });
      result.summary.invalid++;
      continue;
    }

    result.valid.push({ ...studentData, row: rowNumber });
    result.summary.valid++;
  }

  return result;
}

// ============================================
// BULK CREATE STUDENTS
// ============================================
export async function createStudentsBulk(
  students: StudentImportData[],
  bodyUniversityId: string | undefined,
  adminId: string,
  adminRole: string,
  ip: string | undefined,
  userAgent: string | undefined,
  requestId: string | undefined,
  fileName?: string
): Promise<BulkCreateResult> {
  const startTime = Date.now();

  const result: BulkCreateResult = {
    success: [],
    failed: [],
    summary: {
      total: students.length,
      successful: 0,
      failed: 0,
    },
    mustResetPassword: true,
  };

  // Step 1: Resolve university (server-side, never trust body for ADMIN)
  const universityId = await resolveUniversityId(adminId, adminRole, bodyUniversityId);

  // Step 2: Validate university exists and is active
  const university = await bulkStudentRepo.getUniversityWithDomains(universityId);
  if (!university || !university.isActive) {
    throw new NotFoundError('University');
  }

  // Step 3: Validate email domains against university policy
  const domainFailures = validateEmailDomains(students, university.emailDomains);
  if (domainFailures.length > 0) {
    // Add domain failures and filter out those students
    const failedEmails = new Set(domainFailures.map((f) => f.data.email.toLowerCase()));
    result.failed.push(...domainFailures);
    result.summary.failed += domainFailures.length;

    // Continue with only valid-domain students
    students = students.filter((s) => !failedEmails.has(s.email.toLowerCase()));
    if (students.length === 0) {
      // Record history even if all failed
      await recordBulkHistory(
        universityId,
        adminId,
        fileName || 'unknown.csv',
        result,
        startTime,
        requestId
      );
      return result;
    }
  }

  // Step 4: Check for duplicate emails within the batch
  const emails = students.map((s) => s.email.toLowerCase());
  const duplicateEmails = emails.filter((email, index) => emails.indexOf(email) !== index);
  if (duplicateEmails.length > 0) {
    throw new ValidationError(
      `Duplicate emails in import: ${[...new Set(duplicateEmails)].join(', ')}`
    );
  }

  // Step 5: Check for duplicate register numbers within the batch
  const registerNumbers = students.map((s) => s.registerNumber);
  const duplicateRegNums = registerNumbers.filter(
    (rn, index) => registerNumbers.indexOf(rn) !== index
  );
  if (duplicateRegNums.length > 0) {
    throw new ValidationError(
      `Duplicate register numbers in import: ${[...new Set(duplicateRegNums)].join(', ')}`
    );
  }

  // Step 6: Check existing records in database
  const existingEmails = await bulkStudentRepo.findExistingEmails(emails);
  const existingRegNums = await bulkStudentRepo.findExistingRegisterNumbers(
    registerNumbers,
    universityId
  );

  // Step 7: Process each student
  for (let i = 0; i < students.length; i++) {
    const studentData = students[i]!;
    const rowNumber = i + 2; // Row number in CSV (1-indexed + header)

    try {
      // Skip if email already exists in DB
      if (existingEmails.has(studentData.email.toLowerCase())) {
        result.failed.push({
          row: rowNumber,
          data: studentData,
          error: `Email ${studentData.email} already exists`,
        });
        result.summary.failed++;
        continue;
      }

      // Skip if register number already exists in this university
      if (existingRegNums.has(studentData.registerNumber)) {
        result.failed.push({
          row: rowNumber,
          data: studentData,
          error: `Register number ${studentData.registerNumber} already exists in this university`,
        });
        result.summary.failed++;
        continue;
      }

      // Validate individual row against Zod schema
      const validation = studentImportSchema.safeParse(studentData);
      if (!validation.success) {
        const errorMessages = validation.error.issues.map((issue) => issue.message).join(', ');
        result.failed.push({
          row: rowNumber,
          data: studentData,
          error: errorMessages,
        });
        result.summary.failed++;
        continue;
      }

      // Generate password if not provided
      const password = studentData.password || generatePassword();
      const passwordHash = await hashPassword(password);

      // Create user + student in transaction
      await bulkStudentRepo.createUserAndStudent(
        {
          name: studentData.name,
          email: studentData.email.toLowerCase(),
          passwordHash,
        },
        {
          registerNumber: studentData.registerNumber,
          degree: studentData.degree,
          batch: studentData.batch,
          universityId,
        }
      );

      result.success.push({
        ...studentData,
        password, // Include password for admin to distribute
      });
      result.summary.successful++;
    } catch (error: any) {
      // Concurrency safety: catch Prisma P2002 unique constraint violations
      // This can happen if two admins upload overlapping CSVs simultaneously
      if (error?.code === 'P2002') {
        result.failed.push({
          row: rowNumber,
          data: studentData,
          error: 'Duplicate entry detected (concurrent import conflict)',
        });
      } else {
        result.failed.push({
          row: rowNumber,
          data: studentData,
          error: error.message || 'Unknown error',
        });
      }
      result.summary.failed++;
    }
  }

  // Step 8: Audit log (non-blocking) with requestId
  auditService
    .logAdminAction('BULK_STUDENT_CREATE', null, adminId, ip, userAgent, {
      total: result.summary.total,
      successful: result.summary.successful,
      failed: result.summary.failed,
      universityId,
      universityName: university.name,
      requestId: requestId || 'unknown',
    })
    .catch((err) => logger.error(err));

  // Step 9: Record import in BulkImport history before returning
  await recordBulkHistory(
    universityId,
    adminId,
    fileName || 'unknown.csv',
    result,
    startTime,
    requestId
  );

  // Step 10: Send welcome emails with credentials via Brevo
  if (result.success.length > 0) {
    const emailPayloads: SendEmailOptions[] = result.success.map((student) => ({
      to: student.email,
      subject: 'Welcome to DSA Visualizer - Your Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">Welcome, ${student.name}!</h2>
          <p>Your student account for <strong>${university.name}</strong> has been created successfully.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Login Details:</strong></p>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li><strong>Email:</strong> ${student.email}</li>
              <li><strong>Password:</strong> ${student.password}</li>
            </ul>
          </div>
          <p>Please log in and change your password immediately.</p>
          <p>Best regards,<br>The DSA Visualizer Team</p>
        </div>
      `,
    }));

    // Send emails in background
    sendBulkEmails(emailPayloads)
      .then((res) => logger.info(`[EmailService] Bulk emails dispatched: ${res.length}`))
      .catch((err) => logger.error('[EmailService] Bulk email error:', err));
  }

  return result;
}

/**
 * Helper to record bulk import history without blocking the main response.
 */
async function recordBulkHistory(
  universityId: string,
  adminId: string,
  fileName: string,
  result: BulkCreateResult,
  startTime: number,
  requestId: string | undefined
): Promise<void> {
  const durationMs = Date.now() - startTime;
  const status = result.summary.failed > 0 ? 'completed_with_errors' : 'completed';

  try {
    await bulkStudentRepo.createBulkImportRecord({
      universityId,
      createdBy: adminId,
      fileName,
      total: result.summary.total,
      successful: result.summary.successful,
      failed: result.summary.failed,
      status,
      failedRows: result.failed.length > 0 ? result.failed : undefined,
      durationMs,
      requestId: requestId || undefined,
    });
  } catch (err) {
    logger.error('[BulkImportHistory] Failed to record:', err);
  }
}
