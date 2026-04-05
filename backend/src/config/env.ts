// src/config/env.ts
// Validates all environment variables at startup using Zod.
// Justification: Backend-DevSkill.md — "Env vars validated with Zod"
// Fail-fast: if any variable is missing or invalid, the process exits
// before the server starts, preventing silent misconfiguration.

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Database — postgresql-skill.md requires PostgreSQL as source of truth
  DATABASE_URL: z.string().url(),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_CA_CERT_PATH: z.string().optional(),

  // Redis — Backend-DevSkill.md: "Redis 7+ for caching and sessions"
  REDIS_URL: z.string().url(),

  // Server
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Security — Backend-DevSkill.md: "JWT with access + refresh tokens"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_PRIVATE_KEY: z.string().optional(),
  JWT_PUBLIC_KEY: z.string().optional(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Password — Backend-DevSkill.md: "bcrypt hashing (≥12 rounds)"
  BCRYPT_ROUNDS: z.string().default('12').transform(Number).pipe(z.number().min(10).max(15)),

  // CORS — Backend-DevSkill.md: "CORS configured explicitly"
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Email API (Brevo SMTP)
  SMTP_HOST: z.string().default('smtp-relay.brevo.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default('a6abf4001@smtp-brevo.com'),
  SMTP_PASS: z
    .string()
    .default(
      'xsmtpsib-1c2ac9a25e6ae6ed1bfe74ccc2b5487104aaac862c9c377be67e84b9c821c1a6-wt6mgYkePLfF7TN8'
    ),
  EMAIL_FROM: z.string().default('noreply@dsavisualizer.com'),
  EMAIL_ENABLED: z.coerce.boolean().optional(),

  // Code execution engine endpoint (Piston)
  PISTON_URL: z.string().url().optional(),

  // Ops preflight checks
  PREFLIGHT_TOKEN: z.string().optional(),
  PREFLIGHT_TIMEOUT_MS: z.coerce.number().default(5000).pipe(z.number().min(1000).max(30000)),
  PREFLIGHT_REQUIRE_SMTP: z.coerce.boolean().optional(),

  // Monitoring Sentry
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`❌ Environment validation failed:\n${formatted}`);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
