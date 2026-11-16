import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export function hasDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL;
  const configured = Boolean(url && url.length > 10 && !url.includes('USER:PASSWORD'));
  if (process.env.NODE_ENV === 'production' && !configured) {
    throw new Error('DATABASE_URL must be configured in production.');
  }
  return configured;
}
