// src/utils/password.ts
// Password hashing and verification using bcrypt.
// Justification: Backend-DevSkill.md — "bcrypt hashing (≥12 rounds)"
// Rounds configured via env.BCRYPT_ROUNDS (min 10, max 15, default 12).

import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
