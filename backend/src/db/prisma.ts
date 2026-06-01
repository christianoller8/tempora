import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient — one connection pool per process.
// In development, store on globalThis to prevent hot-reload from creating multiple pools.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });
}

export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'production'
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());
