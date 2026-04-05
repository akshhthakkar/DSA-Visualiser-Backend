// src/config/database.ts
// Singleton PrismaClient configured with @prisma/adapter-pg driver adapter.
// Prisma 7 requires a driver adapter — no more datasourceUrl/datasources.
// Justification: postgre-skill.md "Use connection pooling for all DB access"

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './env.js';

const isTlsConnectionRequested = /(?:^|[?&])(sslmode|ssl|sslaccept)=/i.test(env.DATABASE_URL);

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function loadDatabaseCa(): string | undefined {
  if (env.DATABASE_CA_CERT?.trim()) {
    return normalizePem(env.DATABASE_CA_CERT);
  }

  if (env.DATABASE_CA_CERT_PATH?.trim()) {
    const certPath = resolve(process.cwd(), env.DATABASE_CA_CERT_PATH);
    const certContents = readFileSync(certPath, 'utf8');
    return normalizePem(certContents);
  }

  return undefined;
}

const databaseCa = loadDatabaseCa();

const hasTlsQueryParam = /(?:^|[?&])(sslmode|ssl|sslaccept)=/i.test(env.DATABASE_URL);
if (
  env.NODE_ENV !== 'production' &&
  hasTlsQueryParam &&
  !databaseCa &&
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === undefined
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

if (env.NODE_ENV === 'production' && isTlsConnectionRequested && !databaseCa) {
  throw new Error(
    'Production database TLS requires a trusted CA certificate. Set DATABASE_CA_CERT or DATABASE_CA_CERT_PATH.'
  );
}

const shouldRejectUnauthorized = env.NODE_ENV === 'production' || Boolean(databaseCa);

const poolConfig = {
  connectionString: env.DATABASE_URL,
  ssl: isTlsConnectionRequested
    ? {
        rejectUnauthorized: shouldRejectUnauthorized,
        ...(databaseCa ? { ca: databaseCa } : {}),
      }
    : undefined,
};

const adapter = new PrismaPg(poolConfig);

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
