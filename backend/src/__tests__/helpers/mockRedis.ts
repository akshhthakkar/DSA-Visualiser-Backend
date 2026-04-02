import { vitest } from 'vitest';

export const mockRedis = {
  get: vitest.fn(),
  set: vitest.fn(),
  del: vitest.fn(),
  setex: vitest.fn(),
  ping: vitest.fn().mockResolvedValue('PONG'),
  connect: vitest.fn().mockResolvedValue(true),
  quit: vitest.fn().mockResolvedValue(true),
  on: vitest.fn(),
};

// You can use vitest.mock('../../config/redis.js', () => ({ redis: mockRedis }))
// in tests where you completely want to mock Redis rather than using the real one.
