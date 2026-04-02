import type { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../config/redis.js';
import { RateLimitError } from '../utils/errors.js';

interface RateLimitOptions {
  max: number;
  timeWindow: number; // in seconds
}

/**
 * Middleware for per-user rate limiting using Redis.
 * Uses a simple fixed window counter method.
 *
 * @param options max requests, timeWindow in seconds
 */
export function rateLimitPerUser(options: RateLimitOptions) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) {
      // If no user context exists, we don't apply user-based rate limit
      return;
    }

    const userId = request.user.userId;
    // We limit per user generically, or you could add `request.routeOptions.url` to the key for per-route limits.
    // The requirement says "Per-User Rate Limiting" so we'll do an overarching per-user limit.
    const currentWindow = Math.floor(Date.now() / 1000 / options.timeWindow);
    const key = `rate-limit:user:${userId}:${currentWindow}`;

    const current = await redis.incr(key);

    if (current === 1) {
      // Set expiration to slightly longer than the window to let it naturally expire
      await redis.expire(key, options.timeWindow * 2);
    }

    if (current > options.max) {
      throw new RateLimitError(`Rate limit exceeded. Please try again later.`);
    }
  };
}
