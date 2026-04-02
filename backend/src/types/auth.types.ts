// src/types/auth.types.ts
// Zod validation schemas for authentication endpoints.
// Justification: Backend-DevSkill.md — "Validate all inputs with Zod"
// Password strength: min 8, uppercase, lowercase, digit, special char.
// Conditional fields for student vs teacher signup.

import { z } from 'zod';

// --- Password strength regex ---
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;

// --- Signup schema ---
export const signupSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        passwordRegex,
        'Password must contain uppercase, lowercase, digit, and special character'
      ),
    role: z.enum(['STUDENT', 'TEACHER'], {
      error: 'Role must be STUDENT or TEACHER',
    }),
    universityId: z.string().uuid('Invalid university ID'),

    // Student-specific fields (required if role=STUDENT)
    registerNumber: z.string().min(3, 'Register number must be at least 3 characters').optional(),
    degree: z.string().min(1).optional(),
    batch: z.string().min(1).optional(),

    // Teacher-specific fields
    department: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'STUDENT') {
      if (!data.registerNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Register number is required for students',
          path: ['registerNumber'],
        });
      }
      if (!data.degree) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Degree is required for students',
          path: ['degree'],
        });
      }
      if (!data.batch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Batch is required for students',
          path: ['batch'],
        });
      }
    }
  });

// --- Login schema ---
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// --- Inferred types ---
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// --- New Schemas ---
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      passwordRegex,
      'Password must contain uppercase, lowercase, digit, and special character'
    ),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
