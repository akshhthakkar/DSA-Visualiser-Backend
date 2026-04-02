import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';
import type { UserRole } from '@prisma/client';

export async function createTestUser(overrides?: {
  name?: string;
  email?: string;
  role?: UserRole;
  password?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}) {
  const email = overrides?.email ?? `testuser_${Date.now()}@example.com`;
  const name = overrides?.name ?? 'Test User';
  const role = overrides?.role ?? 'STUDENT';
  const password = overrides?.password ?? 'Test@123';
  const isActive = overrides?.isActive ?? true;
  const emailVerified = overrides?.emailVerified ?? true;

  const passwordHash = await hashPassword(password);

  return await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash,
      isActive,
      emailVerified,
    },
  });
}

export async function createTestUniversity(overrides?: {
  name?: string;
  shortName?: string;
  emailDomains?: string[];
}) {
  return await prisma.university.create({
    data: {
      name: overrides?.name ?? 'Test University',
      shortName: overrides?.shortName ?? 'TU',
      emailDomains: overrides?.emailDomains ?? ['test.edu'],
      country: 'USA',
      state: 'California',
      city: 'San Francisco',
    },
  });
}

export async function createTestStudent(
  userOverrides?: { email?: string; name?: string },
  universityId?: string
) {
  const user = await createTestUser({ role: 'STUDENT', ...userOverrides });
  const uni = universityId ? { id: universityId } : await createTestUniversity();

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      universityId: uni.id,
      registerNumber: `REG-${Date.now()}`,
      degree: 'Computer Science',
      batch: '2024',
    },
  });

  return { user, student, university: uni };
}
