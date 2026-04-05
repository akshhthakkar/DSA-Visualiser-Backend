// src/services/auth.service.ts
// Authentication business logic — signup, login, logout, refresh.
// Justification: Backend-DevSkill.md — "Controller → Service → Repository"
//
// Critical rules:
//   - Never return passwordHash in any response
//   - Generic "Invalid credentials" on all login failures
//   - prisma.$transaction() for atomic signup (user + profile)
//   - AuditLog entries for every auth event

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import * as userRepo from '../repositories/user.repository.js';
import * as sessionRepo from '../repositories/session.repository.js';
import * as auditService from './audit.service.js';
import { logger } from '../config/logger.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../types/auth.types.js';
import type {
  SignupInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../types/auth.types.js';
import { AuthenticationError, ConflictError, ValidationError } from '../utils/errors.js';
import { sendEmail } from './email.service.js';
import { getVerificationEmailTemplate, getPasswordResetTemplate } from '../utils/emailTemplates.js';
import { createFingerprint } from '../utils/fingerprint.js';

// ============================================
// SIGNUP
// ============================================
export async function signup(input: SignupInput, ip: string, userAgent: string) {
  // 1. Validate
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }
  const data = parsed.data;

  // 2. Check duplicate email
  const existing = await userRepo.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // 3. Hash password
  const passwordHash = await hashPassword(data.password);

  // 4. Atomic creation: User + Student/Teacher profile
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await userRepo.create(
      {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
      tx
    );

    if (data.role === 'STUDENT') {
      await tx.student.create({
        data: {
          userId: newUser.id,
          registerNumber: data.registerNumber!,
          degree: data.degree!,
          batch: data.batch!,
          universityId: data.universityId,
        },
      });
    } else {
      await tx.teacher.create({
        data: {
          userId: newUser.id,
          universityId: data.universityId,
          department: data.department ?? null,
        },
      });
    }

    return newUser;
  });

  // 4b/4c. Verification token + email is best-effort and should not block signup.
  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenDelegate = (prisma as any).emailVerificationToken;

    if (emailVerificationTokenDelegate?.create) {
      await emailVerificationTokenDelegate.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      const template = getVerificationEmailTemplate(user.name, verificationToken);
      sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
      }).catch((err) => logger.error('Failed to send verification email:', err));
    } else {
      logger.warn(
        'emailVerificationToken model not available; skipping verification token creation'
      );
    }
  } catch (error) {
    logger.warn('Signup succeeded but verification email setup failed', error);
  }

  // 5. Generate tokens
  const fingerprint = createFingerprint(ip, userAgent);
  const tokenPayload = { userId: user.id, email: user.email, role: user.role, fingerprint };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 6. Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await sessionRepo.create({
    userId: user.id,
    refreshToken,
    ipAddress: ip,
    userAgent,
    expiresAt,
  });

  // 7. Audit log (non-blocking)
  auditService
    .logAuthEvent('AUTH_SIGNUP', user.id, ip, userAgent)
    .catch((err) => logger.error(err));

  return { user, accessToken, refreshToken };
}

// ============================================
// LOGIN
// ============================================
export async function login(input: LoginInput, ip: string, userAgent: string) {
  // 1. Validate
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }
  const data = parsed.data;

  // 2. Find user (includes passwordHash for verification)
  const user = await userRepo.findByEmail(data.email);
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 3. Check active
  if (!user.isActive) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 4. Verify password
  const passwordValid = await verifyPassword(data.password, user.passwordHash);
  if (!passwordValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // 5. Update login stats
  await userRepo.updateLastLogin(user.id);

  // 6. Generate tokens
  const fingerprint = createFingerprint(ip, userAgent);
  const tokenPayload = { userId: user.id, email: user.email, role: user.role, fingerprint };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 7. Create session
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await sessionRepo.create({
    userId: user.id,
    refreshToken,
    ipAddress: ip,
    userAgent,
    expiresAt,
  });

  // 8. Audit log (non-blocking)
  auditService.logAuthEvent('AUTH_LOGIN', user.id, ip, userAgent).catch((err) => logger.error(err));

  // Strip passwordHash before returning
  const { passwordHash: _, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken };
}

// ============================================
// LOGOUT
// ============================================
export async function logout(refreshToken: string, ip: string, userAgent: string) {
  // Look up the session to find the user for audit logging
  const session = await sessionRepo.findByRefreshToken(refreshToken);

  // Delete session (silently succeeds even if not found)
  await sessionRepo.deleteByRefreshToken(refreshToken);

  // Audit log (non-blocking, if session was found)
  if (session) {
    auditService
      .logAuthEvent('AUTH_LOGOUT', session.userId, ip, userAgent)
      .catch((err) => logger.error(err));
  }
}

// ============================================
// REFRESH ACCESS TOKEN
// ============================================
export async function refreshAccessToken(refreshToken: string) {
  // 1. Find session
  const session = await sessionRepo.findByRefreshToken(refreshToken);
  if (!session) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // 2. Check expiry
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await sessionRepo.deleteByRefreshToken(refreshToken);
    throw new AuthenticationError('Refresh token has expired');
  }

  // 3. Check user active & not soft-deleted
  if (!session.user.isActive || session.user.deletedAt !== null) {
    throw new AuthenticationError('Account is deactivated');
  }

  // 4. Generate new access token only
  const accessToken = generateAccessToken({
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
  });

  // 5. Update session activity
  await sessionRepo.updateLastActivity(refreshToken);

  return { accessToken };
}
// ============================================
// EMAIL VERIFICATION
// ============================================
export async function verifyEmail(input: VerifyEmailInput, ip: string, userAgent: string) {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }

  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new AuthenticationError('Invalid or expired verification token');
  }

  if (tokenRecord.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: tokenRecord.id } });
    throw new AuthenticationError('Verification token has expired');
  }

  // Update user and clean up token
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    await tx.emailVerificationToken.deleteMany({
      where: { userId: tokenRecord.userId },
    });
  });

  auditService
    .logAuthEvent('AUTH_VERIFY_EMAIL', tokenRecord.userId, ip, userAgent)
    .catch((err) => logger.error(err));
}

export async function resendVerificationEmail(input: ResendVerificationInput) {
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }

  const user = await userRepo.findByEmail(parsed.data.email);
  if (!user || user.emailVerified) {
    // For security, do not reveal if user exists or is already verified
    return;
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  await prisma.$transaction(async (tx) => {
    // Delete old tokens first
    await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await tx.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  const template = getVerificationEmailTemplate(user.name, verificationToken);
  sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
  }).catch((err) => logger.error('Failed to send resend email:', err));
}

// ============================================
// PASSWORD RESET
// ============================================
export async function forgotPassword(input: ForgotPasswordInput, ip: string, userAgent: string) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }

  const user = await userRepo.findByEmail(parsed.data.email);
  if (!user) {
    return; // Do not reveal existence
  }

  const resetToken = crypto.randomBytes(32).toString('hex');

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });
  });

  const template = getPasswordResetTemplate(user.name, resetToken);
  sendEmail({
    to: user.email,
    subject: template.subject,
    html: template.html,
  }).catch((err) => logger.error('Failed to send password reset email:', err));

  auditService
    .logAuthEvent('AUTH_FORGOT_PASSWORD', user.id, ip, userAgent)
    .catch((err) => logger.error(err));
}

export async function resetPassword(input: ResetPasswordInput, ip: string, userAgent: string) {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Validation failed', parsed.error.issues);
  }

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  if (tokenRecord.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } });
    throw new AuthenticationError('Reset token has expired');
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash, mustResetPassword: false },
    });
    // Invalidate all tokens and sessions
    await tx.passwordResetToken.deleteMany({ where: { userId: tokenRecord.userId } });
    await tx.session.deleteMany({ where: { userId: tokenRecord.userId } });
  });

  auditService
    .logAuthEvent('AUTH_RESET_PASSWORD', tokenRecord.userId, ip, userAgent)
    .catch((err) => logger.error(err));
}
