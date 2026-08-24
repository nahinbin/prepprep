/**
 * End-to-end verification using the same client setup as src/lib/prisma.ts
 * (PrismaPg adapter + POSTGRES_PRISMA_URL).
 *
 * Usage: node --env-file=.env scripts/verify-prisma-pg.mjs
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL });
const prisma = new PrismaClient({ adapter });

try {
    const [users, subjects, topics, questions, sessions, attempts, mistakes, rewards, orders, transactions, settings] =
        await Promise.all([
            prisma.user.count(),
            prisma.subject.count(),
            prisma.topic.count(),
            prisma.question.count(),
            prisma.session.count(),
            prisma.attempt.count(),
            prisma.mistake.count(),
            prisma.reward.count(),
            prisma.order.count(),
            prisma.coinTransaction.count(),
            prisma.appSettings.count(),
        ]);

    console.log('Counts via Prisma Client (pooled URL):');
    console.log({ users, subjects, topics, questions, sessions, attempts, mistakes, rewards, orders, transactions, settings });

    // Spot-check relations, booleans and datetimes round-trip correctly
    const attempt = await prisma.attempt.findFirst({
        where: { isCorrect: true },
        orderBy: { id: 'asc' },
        select: { id: true, isCorrect: true, session: { select: { user: { select: { username: true } } } } },
    });
    console.log('Sample correct attempt w/ relation:', attempt);

    const mistake = await prisma.mistake.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, isCorrected: true, fromPractice: true, createdAt: true, updatedAt: true },
    });
    console.log('Latest mistake (dates):', mistake);

    const question = await prisma.question.findFirst({
        orderBy: { externalId: 'asc' },
        select: { id: true, externalId: true, subject: { select: { name: true } }, topic: { select: { name: true } } },
    });
    console.log('Sample question w/ relations:', question);

    const settingsRow = await prisma.appSettings.findFirst();
    console.log('AppSettings:', settingsRow);

    console.log('\nPRISMA CLIENT VERIFICATION PASSED');
} finally {
    await prisma.$disconnect();
}