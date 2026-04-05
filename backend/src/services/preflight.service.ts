import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { verifyEmailTransport } from './email.service.js';
import { env } from '../config/env.js';

type CheckState = 'healthy' | 'unhealthy';

type ServiceCheck = {
  state: CheckState;
  latencyMs: number;
  error?: string;
};

export type PreflightReport = {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    database: ServiceCheck;
    redis: ServiceCheck;
    smtp: ServiceCheck;
  };
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function timedCheck(check: () => Promise<void>): Promise<ServiceCheck> {
  const startedAt = Date.now();
  try {
    await check();
    return {
      state: 'healthy',
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: 'unhealthy',
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
}

export async function runPreflightChecks(): Promise<PreflightReport> {
  const timeoutMs = env.PREFLIGHT_TIMEOUT_MS;
  const requireSmtp = env.PREFLIGHT_REQUIRE_SMTP ?? env.NODE_ENV === 'production';

  const [database, redisCheck, smtp] = await Promise.all([
    timedCheck(async () => {
      await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs, 'database check');
    }),
    timedCheck(async () => {
      const pong = await withTimeout(redis.ping(), timeoutMs, 'redis check');
      if (pong !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${pong}`);
      }
    }),
    requireSmtp
      ? timedCheck(async () => {
          await withTimeout(verifyEmailTransport(), timeoutMs, 'smtp check');
        })
      : Promise.resolve({
          state: 'healthy' as const,
          latencyMs: 0,
        }),
  ]);

  const status =
    database.state === 'healthy' && redisCheck.state === 'healthy' && smtp.state === 'healthy'
      ? 'ok'
      : 'degraded';

  return {
    status,
    timestamp: new Date().toISOString(),
    services: {
      database,
      redis: redisCheck,
      smtp,
    },
  };
}
