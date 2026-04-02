// prisma.config.ts
// Prisma 7 configuration file.
// Connection URL is defined here instead of in schema.prisma.
// See: https://pris.ly/d/config-datasource

import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config();

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error(
    '❌ DATABASE_URL is not set. Make sure it is configured in your environment variables.'
  );
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),

  datasource: {
    url: databaseUrl,
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
