// src/__tests__/unit/jwt.test.ts
// Unit tests for JWT token generation and verification.

import { describe, it, expect } from 'vitest';
import { generateAccessToken, verifyToken } from '../../utils/jwt.js';
import { AuthenticationError } from '../../utils/errors.js';
import jwt from 'jsonwebtoken';

const testPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  role: 'STUDENT' as const,
};

describe('JWT Utils', () => {
  it('should generate a valid access token', () => {
    const token = generateAccessToken(testPayload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('should decode a valid access token correctly', () => {
    const token = generateAccessToken(testPayload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
    expect(decoded.role).toBe(testPayload.role);
  });

  it('should throw AuthenticationError on expired token', () => {
    // Create a token that's already expired
    const token = jwt.sign(
      testPayload,
      process.env['JWT_SECRET'] || 'test-secret-that-is-at-least-32-characters-long!!',
      {
        expiresIn: '0s',
        issuer: 'dsa-visualizer',
      }
    );

    expect(() => verifyToken(token)).toThrow(AuthenticationError);
    expect(() => verifyToken(token)).toThrow('Token has expired');
  });

  it('should throw AuthenticationError on tampered/invalid token', () => {
    const token = generateAccessToken(testPayload);
    const tampered = token + 'tampered';

    expect(() => verifyToken(tampered)).toThrow(AuthenticationError);
    expect(() => verifyToken(tampered)).toThrow('Invalid token');
  });
});
