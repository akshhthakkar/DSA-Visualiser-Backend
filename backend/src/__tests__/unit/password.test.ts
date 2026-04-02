// src/__tests__/unit/password.test.ts
// Unit tests for password hashing and verification.

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../utils/password.js';

describe('Password Utils', () => {
  it('should hash password to a bcrypt string that differs from plaintext', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toHaveLength(60);
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('should verify correct password returns true', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password returns false', async () => {
    const password = 'Test123!@#';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('WrongPassword!1', hash);
    expect(isValid).toBe(false);
  });
});
