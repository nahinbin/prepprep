import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaClient = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const adapter = new PrismaPg({
    connectionString: process.env.POSTGRES_PRISMA_URL,
  });
  return new PrismaClient({ adapter });
};

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
