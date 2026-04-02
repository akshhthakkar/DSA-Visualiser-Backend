// src/config/database.ts
// Singleton PrismaClient configured with @prisma/adapter-pg driver adapter.
// Prisma 7 requires a driver adapter — no more datasourceUrl/datasources.
// Justification: postgre-skill.md "Use connection pooling for all DB access"

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
