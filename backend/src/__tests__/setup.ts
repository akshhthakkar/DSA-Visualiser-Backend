// src/__tests__/setup.ts
// Test infrastructure — Phase 0.
// Justification: implementation-roadmap.md Step 0.8
//
// Connects to the test database, truncates all tables
// before each test to guarantee isolation.
// Table order respects FK dependency (children first).

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import Redis from 'ioredis';

const testRedis = new Redis(env.REDIS_URL, { keyPrefix: 'dsa:', lazyConnect: true });

beforeAll(async () => {
  await prisma.$connect();
  await testRedis.connect();
});

afterAll(async () => {
  await testRedis.quit();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Truncate in reverse FK-dependency order
  const tables = [
    'audit_logs',
    'sessions',
    'student_progress',
    'bulk_imports',
    'class_students',
    'classes',
    'problems',
    'syllabus',
    'students',
    'teachers',
    'users',
    'universities',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
  }

  // Flush Redis test data
  await testRedis.flushdb();
});

export { prisma, testRedis };
