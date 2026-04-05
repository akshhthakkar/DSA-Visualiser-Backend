import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  listUsers,
  getUserById,
  updateUser,
  changeRole,
  deleteUser,
} from '../../../services/admin.service.js';
import * as auditService from '../../../services/audit.service.js';
import { createTestUser } from '../../helpers/fixtures.js';
import { prisma } from '../../../config/database.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../utils/errors.js';

vi.spyOn(auditService, 'logAdminAction').mockResolvedValue(undefined);

describe('Admin Service', () => {
  let adminId: string;
  let superAdminId: string;

  beforeEach(async () => {
    const admin = await createTestUser({
      email: 'admin@test.com',
      role: 'ADMIN',
      name: 'Admin Guy',
    });
    const superAdmin = await createTestUser({
      email: 'super@test.com',
      role: 'SUPER_ADMIN',
      name: 'Super Guy',
    });
    adminId = admin.id;
    superAdminId = superAdmin.id;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('listUsers()', () => {
    it('should list and paginate active users', async () => {
      await createTestUser({ email: 'u1@test.com' });
      await createTestUser({ email: 'u2@test.com' });
      const result = await listUsers(1, 10, {}, adminId, '127.0.0.1', 'Vitest');
      expect(result.users.length).toBeGreaterThanOrEqual(4);
      expect(result.pagination.total).toBeGreaterThanOrEqual(4);
    });

    it('should filter users by query correctly', async () => {
      await createTestUser({ email: 'searchable@test.com', name: 'Zebra' });
      const result = await listUsers(1, 10, { search: 'Zebra' }, adminId, '127.0.0.1', 'Vitest');
      expect(result.users.length).toBe(1);
      expect(result.users[0]!.email).toBe('searchable@test.com');
    });
  });

  describe('getUserById()', () => {
    it('should successfully get an existing user', async () => {
      const user = await createTestUser({ email: 'findme@test.com', role: 'STUDENT' });
      const foundUser = await getUserById(user.id, adminId, '127.0.0.1', 'Vitest');
      expect(foundUser.userId).toBe(user.id);
      expect(foundUser.email).toBe('findme@test.com');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      await expect(
        getUserById('00000000-0000-0000-0000-000000000000', adminId, '127.0.0.1', 'Vitest')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUser()', () => {
    it('should allow an admin to update a normal user', async () => {
      const targetUser = await createTestUser({ email: 'updateme@test.com' });
      const updated = await updateUser(
        targetUser.id,
        { name: 'Updated Name', isActive: false },
        adminId,
        '127.0.0.1',
        'Mozilla'
      );
      expect(updated.name).toBe('Updated Name');
      expect(updated.isActive).toBe(false);
    });

    it('should prevent an admin from updating a SUPER_ADMIN', async () => {
      await expect(
        updateUser(superAdminId, { name: 'Hacked Name' }, adminId, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow(AuthorizationError);
    });

    it('should prevent an admin from updating themselves', async () => {
      await expect(
        updateUser(adminId, { name: 'Self Change' }, adminId, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('changeRole()', () => {
    it('should successfully change student to teacher', async () => {
      const targetUser = await createTestUser({ email: 'role@test.com', role: 'STUDENT' });
      const updated = await changeRole(targetUser.id, 'TEACHER', adminId, '127.0.0.1', 'Mozilla');
      expect(updated.role).toBe('TEACHER');
    });

    it('should not allow assignment of SUPER_ADMIN role', async () => {
      const targetUser = await createTestUser({ email: 'wantssuper@test.com', role: 'STUDENT' });
      await expect(
        changeRole(targetUser.id, 'SUPER_ADMIN', adminId, '127.0.0.1', 'Mozilla')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteUser()', () => {
    it('should soft delete a target user', async () => {
      const targetUser = await createTestUser({ email: 'deleteme@test.com' });
      await deleteUser(targetUser.id, adminId, '127.0.0.1', 'Mozilla');
      const dbUser = await prisma.user.findUnique({ where: { id: targetUser.id } });
      expect(dbUser!.deletedAt).not.toBeNull();
      expect(dbUser!.isActive).toBe(false);
    });

    it('should not allow deletion of SUPER_ADMIN', async () => {
      await expect(deleteUser(superAdminId, adminId, '127.0.0.1', 'Mozilla')).rejects.toThrow(
        AuthorizationError
      );
    });

    it('should not allow self-deletion', async () => {
      await expect(deleteUser(adminId, adminId, '127.0.0.1', 'Mozilla')).rejects.toThrow(
        ValidationError
      );
    });
  });
});
