// src/utils/jwt.ts
// JWT token generation and verification using jsonwebtoken.
// Justification: Backend-DevSkill.md — "JWT with access + refresh tokens"
// HS256 for dev; RS256 deferred to production hardening.

import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { AuthenticationError } from './errors.js';
import type { UserRole } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  fingerprint?: string;
}

interface DecodedToken extends JWTPayload {
  iss: string;
  iat: number;
  exp: number;
}

// RS256 or HS256 depending on environment setup
const getPrivateKey = () => {
  if (env.JWT_PRIVATE_KEY) {
    return Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('ascii');
  }
  return env.JWT_SECRET || 'fallback-secret';
};

const getPublicKey = () => {
  if (env.JWT_PUBLIC_KEY) {
    return Buffer.from(env.JWT_PUBLIC_KEY, 'base64').toString('ascii');
  }
  return env.JWT_SECRET || 'fallback-secret';
};

const getAlgorithm = (): jwt.Algorithm => (env.JWT_PRIVATE_KEY ? 'RS256' : 'HS256');

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, getPrivateKey(), {
    expiresIn: env.JWT_ACCESS_EXPIRY as unknown as jwt.SignOptions['expiresIn'],
    issuer: 'dsa-visualizer',
    algorithm: getAlgorithm(),
  });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, getPrivateKey(), {
    expiresIn: env.JWT_REFRESH_EXPIRY as unknown as jwt.SignOptions['expiresIn'],
    issuer: 'dsa-visualizer',
    algorithm: getAlgorithm(),
  });
}

export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, getPublicKey(), {
      issuer: 'dsa-visualizer',
      algorithms: [getAlgorithm()],
    }) as DecodedToken;

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }
}
