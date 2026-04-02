// prisma.config.ts
// Prisma 7 configuration file.
// Connection URL is defined here instead of in schema.prisma.
// See: https://pris.ly/d/config-datasource

import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),

  datasource: {
    // Falls back to empty string at build time (prisma generate doesn't need a URL).
    // At runtime, Render injects the real DATABASE_URL before migration runs.
    url: process.env['DATABASE_URL'] ?? '',
  },

  migrate: {
    async development() {
      return {
        url: process.env['DATABASE_URL']!,
      };
    },
    seed: 'npx tsx prisma/seed.ts',
  },
});
