// src/config/redis.ts
// Singleton Redis client configured with ioredis.
// Justification: Backend-DevSkill.md — "Redis 7+ for caching and sessions"
//
// Uses lazyConnect so importing this module doesn't trigger a connection.
// The Fastify onReady hook in app.ts calls redis.connect().
// Key prefix "dsa:" follows the namespacing rule from Backend-DevSkill.md.

import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  keyPrefix: 'dsa:',
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null; // stop retrying after 5 attempts
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  logger.error(`Redis connection error: ${err.message}`);
});
