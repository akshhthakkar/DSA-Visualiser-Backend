import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signup, login, logout, refreshAccessToken } from '../../../services/auth.service.js';
import { prisma } from '../../../config/database.js';
import * as auditService from '../../../services/audit.service.js';
import { createTestUniversity, createTestUser } from '../../helpers/fixtures.js';
import { AuthenticationError, ConflictError, ValidationError } from '../../../utils/errors.js';

// Spy on audit logging so it doesn't fail or pollute logs during tests
vi.spyOn(auditService, 'logAuthEvent').mockResolvedValue(undefined);

describe('Auth Service', () => {
  let universityId: string;

  beforeEach(async () => {
    const uni = await createTestUniversity();
    universityId = uni.id;
  });

  describe('signup()', () => {
    it('should successfully create a new STUDENT user and profile', async () => {
      const result = await signup(
        {
          name: 'John Doe',
          email: 'johndoe@test.edu',
          password: 'Password@123',
          role: 'STUDENT',
          universityId,
          registerNumber: '12345',
          degree: 'B.Tech',
          batch: '2024',
        },
        '127.0.0.1',
        'Mozilla'
      );

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('johndoe@test.edu');
      expect((result.user as any).passwordHash).toBeUndefined(); // Should not include password hash initially or returned safe
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const dbUser = await prisma.user.findUnique({ where: { email: 'johndoe@test.edu' } });
      const dbStudent = await prisma.student.findUnique({ where: { userId: dbUser!.id } });

      expect(dbUser).toBeDefined();
      expect(dbStudent).toBeDefined();
      expect(dbStudent!.registerNumber).toBe('12345');

      expect(auditService.logAuthEvent).toHaveBeenCalledWith(
        'AUTH_SIGNUP',
        dbUser!.id,
        '127.0.0.1',
        'Mozilla'
      );
    });

    it('should successfully create a new TEACHER user and profile', async () => {
      const result = await signup(
        {
          name: 'Jane Smith',
          email: 'janesmith@test.edu',
          password: 'Password@123',
          role: 'TEACHER',
          universityId,
          department: 'Computer Science',
        },
        '127.0.0.1',
        'Mozilla'
      );

      expect(result.user.role).toBe('TEACHER');

      const dbTeacher = await prisma.teacher.findUnique({ where: { userId: result.user.id } });
      expect(dbTeacher).toBeDefined();
      expect(dbTeacher!.department).toBe('Computer Science');
    });

    it('should fail if email already exists', async () => {
      await createTestUser({ email: 'duplicate@test.edu' });

      await expect(
        signup(
          {
            name: 'New Guy',
            email: 'duplicate@test.edu',
            password: 'Password@123',
            role: 'STUDENT',
            universityId,
            registerNumber: '111',
            degree: 'B.Tech',
            batch: '2024',
          },
          '127.0.0.1',
          'Mozilla'
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should fail validation without required student fields', async () => {
      await expect(
        signup(
          {
            name: 'Invalid Student',
            email: 'bad@test.edu',
            password: 'Password@123',
            role: 'STUDENT',
            universityId,
            // missing registerNumber, etc.
          } as any,
          '127.0.0.1',
          'Mozilla'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('login()', () => {
    beforeEach(async () => {
      await createTestUser({
        name: 'Login User',
        email: 'login@test.edu',
        password: 'ValidPassword@123',
      });
    });

    it('should successfully login with valid credentials', async () => {
      const result = await login(
        {
          email: 'login@test.edu',
          password: 'ValidPassword@123',
        },
        '127.0.0.1',
        'Mozilla'
      );

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('login@test.edu');
      expect((result.user as any).passwordHash).toBeUndefined(); // Crucial security assertion
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      expect(auditService.logAuthEvent).toHaveBeenCalledWith(
        'AUTH_LOGIN',
        result.user.id,
        '127.0.0.1',
        'Mozilla'
      );
    });

    it('should throw generic Authentication error on bad password', async () => {
      await expect(
        login(
          {
            email: 'login@test.edu',
            password: 'WrongPassword@123',
          },
          '127.0.0.1',
          'Mozilla'
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw generic Authentication error on bad email', async () => {
      await expect(
        login(
          {
            email: 'nonexistent@test.edu',
            password: 'ValidPassword@123',
          },
          '127.0.0.1',
          'Mozilla'
        )
      ).rejects.toThrow(AuthenticationError);
    });

    it('should reject login if account is inactive', async () => {
      await createTestUser({ email: 'inactive@test.edu', isActive: false });

      await expect(
        login({ email: 'inactive@test.edu', password: 'Test@123' }, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshAccessToken()', () => {
    beforeEach(async () => {
      await createTestUser({
        name: 'Login User',
        email: 'login@test.edu',
        password: 'ValidPassword@123',
      });
    });

    it('should issue a new access token for a valid refresh token', async () => {
      const { refreshToken } = await login(
        { email: 'login@test.edu', password: 'ValidPassword@123' },
        '127.0.0.1',
        'Mozilla'
      );

      const result = await refreshAccessToken(refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
    });

    it('should throw Authentication error for invalid refresh token', async () => {
      await expect(refreshAccessToken('fake-token-abcd')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('logout()', () => {
    beforeEach(async () => {
      await createTestUser({
        name: 'Login User',
        email: 'login@test.edu',
        password: 'ValidPassword@123',
      });
    });

    it('should successfully remove session on logout', async () => {
      const { refreshToken, user } = await login(
        { email: 'login@test.edu', password: 'ValidPassword@123' },
        '127.0.0.1',
        'Mozilla'
      );

      const beforeSession = await prisma.session.findUnique({ where: { refreshToken } });
      expect(beforeSession).toBeDefined();

      await logout(refreshToken, '127.0.0.1', 'Mozilla');

      const afterSession = await prisma.session.findUnique({ where: { refreshToken } });
      expect(afterSession).toBeNull();

      expect(auditService.logAuthEvent).toHaveBeenCalledWith(
        'AUTH_LOGOUT',
        user.id,
        '127.0.0.1',
        'Mozilla'
      );
    });
  });
});
