import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';

let testApp: FastifyInstance;

export async function getTestServer(): Promise<FastifyInstance> {
  if (!testApp) {
    // Avoid double instantiation in the same runner file
    // Note: the test environment configures redis lazily so it wont fail if mocked
    testApp = await buildApp();
    await testApp.ready();
  }
  return testApp;
}

export async function closeTestServer() {
  if (testApp) {
    await testApp.close();
  }
}
