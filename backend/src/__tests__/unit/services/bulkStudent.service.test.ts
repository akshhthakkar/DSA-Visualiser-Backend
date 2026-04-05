import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { validateStudentsBulk, createStudentsBulk } from '../../../services/bulkStudent.service.js';
import * as auditService from '../../../services/audit.service.js';
import * as emailService from '../../../services/email.service.js';
import { createTestUniversity } from '../../helpers/fixtures.js';
import { prisma } from '../../../config/database.js';
import { ValidationError } from '../../../utils/errors.js';
import { hashPassword } from '../../../utils/password.js';

// Mocks
vi.spyOn(auditService, 'logAdminAction').mockResolvedValue(undefined);
const emailSpy = vi.spyOn(emailService, 'sendBulkEmails').mockResolvedValue([]);

describe('Bulk Student Service', () => {
  let universityId: string;
  let adminUserId: string;

  beforeEach(async () => {
    const uni = await createTestUniversity({ emailDomains: ['test.edu'] });
    universityId = uni.id;

    // Create an admin user who is linked to the university via Teacher profile
    const user = await prisma.user.create({
      data: {
        name: 'Uni Admin',
        email: 'admin@test.edu',
        role: 'ADMIN',
        passwordHash: await hashPassword('Test@123'),
      },
    });

    await prisma.teacher.create({
      data: {
        userId: user.id,
        universityId,
      },
    });

    adminUserId = user.id;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStudentsBulk()', () => {
    it('should validate good students correctly', async () => {
      const students = [
        {
          name: 'Student One',
          email: 'one@test.edu',
          registerNumber: 'R01',
          degree: 'BTech',
          batch: '2024',
        },
        {
          name: 'Student Two',
          email: 'two@test.edu',
          registerNumber: 'R02',
          degree: 'BTech',
          batch: '2024',
        },
      ];

      const result = await validateStudentsBulk(students, undefined, adminUserId, 'ADMIN');

      expect(result.summary.total).toBe(2);
      expect(result.valid.length).toBe(2);
      expect(result.invalid.length).toBe(0);
    });

    it('should invalidate students with wrong email domain', async () => {
      const students = [
        {
          name: 'Student One',
          email: 'one@test.edu',
          registerNumber: 'R01',
          degree: 'BTech',
          batch: '2024',
        },
        {
          name: 'Bad Domain',
          email: 'two@gmail.com',
          registerNumber: 'R02',
          degree: 'BTech',
          batch: '2024',
        },
      ];

      const result = await validateStudentsBulk(students, undefined, adminUserId, 'ADMIN');

      expect(result.valid.length).toBe(1);
      expect(result.invalid.length).toBe(1);
      expect(result.invalid[0]!.error).toContain('Email domain not allowed');
    });

    it('should throw error for intra-batch duplicate emails', async () => {
      const students = [
        {
          name: 'Copy 1',
          email: 'copy@test.edu',
          registerNumber: 'R01',
          degree: 'BTech',
          batch: '2024',
        },
        {
          name: 'Copy 2',
          email: 'copy@test.edu',
          registerNumber: 'R02',
          degree: 'BTech',
          batch: '2024',
        },
      ];

      await expect(validateStudentsBulk(students, undefined, adminUserId, 'ADMIN')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('createStudentsBulk()', () => {
    it('should insert valid students into database and dispatch emails', async () => {
      const students = [
        {
          name: 'New Student',
          email: 'new1@test.edu',
          registerNumber: 'R001',
          degree: 'BTech',
          batch: '2025',
        },
      ];

      const result = await createStudentsBulk(
        students,
        undefined,
        adminUserId,
        'ADMIN',
        '127.0.0.1',
        'Mozilla',
        'req-1',
        'test.csv'
      );

      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.success[0]!.password).toBeDefined(); // Password should be generated

      const dbStudent = await prisma.user.findUnique({ where: { email: 'new1@test.edu' } });
      expect(dbStudent).toBeDefined();
      expect(dbStudent!.role).toBe('STUDENT');

      // Ensure emails were sent
      expect(emailSpy).toHaveBeenCalledTimes(1);
      expect(emailSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ to: 'new1@test.edu' })])
      );
    });

    it('should handle partial failures', async () => {
      // Setup existing
      await prisma.user.create({
        data: {
          name: 'Exist',
          email: 'exist@test.edu',
          role: 'STUDENT',
          passwordHash: 'hash',
        },
      });
      const existId = (await prisma.user.findUnique({ where: { email: 'exist@test.edu' } }))!.id;
      await prisma.student.create({
        data: {
          userId: existId,
          universityId,
          registerNumber: 'EXIST1',
          degree: 'BTech',
          batch: '2024',
        },
      });

      const students = [
        {
          name: 'New Guy',
          email: 'fresh@test.edu',
          registerNumber: 'NEW1',
          degree: 'BTech',
          batch: '2025',
        }, // OK
        {
          name: 'Collide Email',
          email: 'exist@test.edu',
          registerNumber: 'NEW2',
          degree: 'BTech',
          batch: '2025',
        }, // Fail: email
      ];

      const result = await createStudentsBulk(
        students,
        undefined,
        adminUserId,
        'ADMIN',
        '127.0.0.1',
        'Mozilla',
        'req-2',
        'test.csv'
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.successful).toBe(1);
      expect(result.summary.failed).toBe(1);
    });
  });
});
