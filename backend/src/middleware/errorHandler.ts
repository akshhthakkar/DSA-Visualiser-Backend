// src/middleware/errorHandler.ts
// Centralized Fastify error handler.
// Justification: Backend-DevSkill.md —
//   "Centralized Fastify error handler"
//   "Log unexpected errors with context"
//   "Return consistent error responses"
//
// Handles: Zod validation, Prisma DB errors, custom AppError, unknown errors.
// Never leaks stack traces in production.

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ValidationError } from '../utils/errors.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
export async function errorHandler(
  error: Error | FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Structured error log — no sensitive data
  request.log.error({
    err: {
      name: error.name,
      message: error.message,
      code: 'code' in error ? error.code : undefined,
    },
    url: request.url,
    method: request.method,
    requestId: request.id,
  });

  // --- Zod validation errors ---
  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // --- Prisma known errors ---
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return reply.status(409).send({
          code: 'CONFLICT',
          message: 'Resource already exists',
        });
      case 'P2025': // Record not found
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        });
      case 'P2003': // Foreign key constraint failed
        return reply.status(400).send({
          code: 'VALIDATION_ERROR',
          message: 'Related resource does not exist',
        });
    }
  }

  // --- Custom AppError hierarchy ---
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
    });
  }

  // --- Fastify built-in errors (e.g. 413, 400 parse errors) ---
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return reply.status(error.statusCode).send({
      code: error.name || 'ERROR',
      message: error.message,
    });
  }

  // --- Unknown / unexpected errors ---
  Sentry.captureException(error);

  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: process.env['NODE_ENV'] === 'development' ? error.message : 'Internal server error',
  });
}
