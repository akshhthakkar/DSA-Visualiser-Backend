import { generateAccessToken } from '../../utils/jwt.js';
import type { UserRole } from '@prisma/client';

export function getMockAuthToken(
  userId: string,
  email: string = 'test@example.com',
  role: UserRole = 'STUDENT'
): string {
  return generateAccessToken({ userId, email, role });
}

export function getMockHeaders(
  userId: string,
  email: string = 'test@example.com',
  role: UserRole = 'STUDENT'
) {
  const token = getMockAuthToken(userId, email, role);
  return {
    Authorization: `Bearer ${token}`,
  };
}
