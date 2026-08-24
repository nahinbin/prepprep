import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Newer versions of the `pg` driver treat `sslmode=require` as full
 * certificate verification, which fails against Supabase's certificate
 * chain ("self-signed certificate"). Appending `uselibpqcompat=true`
 * restores standard libpq SSL semantics for `sslmode=require`.
 * Applied defensively so it works no matter how the env var is set.
 */
function withLibpqCompat(url: string | undefined): string | undefined {
  if (!url || url.includes('uselibpqcompat=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}uselibpqcompat=true`;
}

const getPrismaClient = () => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const adapter = new PrismaPg({
    connectionString: withLibpqCompat(process.env.POSTGRES_PRISMA_URL),
  });
  return new PrismaClient({ adapter });
};

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;