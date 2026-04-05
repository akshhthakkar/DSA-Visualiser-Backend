import { runPreflightChecks } from '../src/services/preflight.service.js';
import { prisma } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';

async function main() {
  try {
    const report = await runPreflightChecks();
    console.log(JSON.stringify(report, null, 2));

    if (report.status !== 'ok') {
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[preflight] failed:', message);
  process.exitCode = 1;
});
