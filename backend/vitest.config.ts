import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // All test files share one database — run sequentially to avoid truncation races
    fileParallelism: false,
    // Integration tests hit real DB/Redis and can exceed 15s on slower runners
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
