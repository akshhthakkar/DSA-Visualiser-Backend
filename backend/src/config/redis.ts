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

type RedisLike = {
  connect: () => Promise<unknown>;
  quit: () => Promise<unknown>;
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string>;
  del: (key: string) => Promise<number>;
  setex: (key: string, seconds: number, value: string) => Promise<string>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  flushdb: () => Promise<string>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

class InMemoryRedis implements RedisLike {
  private store = new Map<string, string>();
  private expiries = new Map<string, NodeJS.Timeout>();

  async connect() {
    return true;
  }

  async quit() {
    for (const timer of this.expiries.values()) {
      clearTimeout(timer);
    }
    this.expiries.clear();
    return true;
  }

  async ping() {
    return 'PONG';
  }

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    const existed = this.store.delete(key);
    const timer = this.expiries.get(key);
    if (timer) {
      clearTimeout(timer);
      this.expiries.delete(key);
    }
    return existed ? 1 : 0;
  }

  async setex(key: string, seconds: number, value: string) {
    await this.set(key, value);
    await this.expire(key, seconds);
    return 'OK';
  }

  async incr(key: string) {
    const current = Number.parseInt((await this.get(key)) ?? '0', 10);
    const next = Number.isNaN(current) ? 1 : current + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number) {
    if (!this.store.has(key)) {
      return 0;
    }

    const existing = this.expiries.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.store.delete(key);
      this.expiries.delete(key);
    }, seconds * 1000);

    this.expiries.set(key, timer);
    return 1;
  }

  async flushdb() {
    this.store.clear();
    for (const timer of this.expiries.values()) {
      clearTimeout(timer);
    }
    this.expiries.clear();
    return 'OK';
  }

  on(_event: string, _listener: (...args: unknown[]) => void) {
    // No-op for in-memory test client.
  }
}

const redisClient: RedisLike =
  env.NODE_ENV === 'test'
    ? new InMemoryRedis()
    : new Redis(env.REDIS_URL, {
        keyPrefix: 'dsa:',
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) return null; // stop retrying after 5 attempts
          return Math.min(times * 200, 2000);
        },
      });

if (env.NODE_ENV !== 'test') {
  redisClient.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Redis connection error: ${message}`);
  });
}

export const redis = redisClient;
