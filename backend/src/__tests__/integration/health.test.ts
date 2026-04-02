// src/__tests__/integration/health.test.ts
// Phase 0 integration test — validates the health endpoint
// and 404 handler work correctly.

import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';

describe('Health Check Endpoint', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('should return 200 with status ok', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toMatchObject({
      status: 'ok',
      environment: 'test',
      redis: 'connected',
    });
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  it('should return 404 for unknown routes', async () => {
    app = await buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: 'NOT_FOUND',
    });
  });
});
