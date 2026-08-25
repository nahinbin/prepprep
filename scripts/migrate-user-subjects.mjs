import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL });
const prisma = new PrismaClient({ adapter });

async function migrate() {
  console.log("Running migration for user-scoped subjects...");

  // 1. Check if first user exists
  const firstUser = await prisma.user.findFirst();
  if (!firstUser) {
    console.log("No users found. Creating table changes directly.");
  }

  // 2. Add userId column to Subject if not present
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "userId" TEXT;
  `);

  // 3. Populate existing subjects with firstUser if userId is null
  if (firstUser) {
    await prisma.$executeRawUnsafe(`
      UPDATE "Subject" SET "userId" = '${firstUser.id}' WHERE "userId" IS NULL;
    `);
  }

  // 4. Set NOT NULL on Subject.userId
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Subject" ALTER COLUMN "userId" SET NOT NULL;
  `);

  // 5. Drop old unique constraint on Subject.name
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Subject" DROP CONSTRAINT IF EXISTS "Subject_name_key";
  `);

  // 6. Create composite unique index on (userId, name)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Subject_userId_name_key" ON "Subject"("userId", "name");
  `);

  // 7. Add foreign key from Subject.userId to User.id
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Subject_userId_fkey'
      ) THEN
        ALTER TABLE "Subject" ADD CONSTRAINT "Subject_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  // 8. Add createdAt column to Question
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  console.log("Database migration completed successfully!");
}

migrate()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
