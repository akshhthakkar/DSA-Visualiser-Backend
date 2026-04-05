import { execSync } from 'node:child_process';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/dsavisualizer?schema=public';
const TEST_REDIS_URL =
  process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379';

const hasTlsQueryParam = /(?:^|[?&])(sslmode|ssl|sslaccept)=/i.test(TEST_DATABASE_URL);
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(TEST_DATABASE_URL);

// Test-only TLS compatibility for hosted DBs that present self-signed/intermediate cert chains.
if (
  (hasTlsQueryParam || !isLocalDatabase) &&
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === undefined
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = TEST_REDIS_URL;
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-min-32-characters-long-value';

const { redis: testRedis } = await import('../config/redis.js');
const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ['error'] });

beforeAll(async () => {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });

  await prisma.$connect();
  await testRedis.connect();
});

afterAll(async () => {
  await testRedis.quit();
  await prisma.$disconnect();
});

beforeEach(async () => {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;

  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`);
    }
  }

  await testRedis.flushdb();
});

export { prisma, testRedis };
