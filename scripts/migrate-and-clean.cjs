const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
  if (!connectionString) {
    console.error("ERROR: No database connection string found in environment.");
    process.exit(1);
  }
  console.log("Connecting to PostgreSQL...");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected successfully.");

  try {
    // ─── 1. Add new self-contained columns to Mistake if they don't exist ───
    console.log("\n[1] Ensuring Mistake table has self-contained columns...");
    await client.query(`
      ALTER TABLE "Mistake"
      ADD COLUMN IF NOT EXISTS "subjectName" TEXT NOT NULL DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS "topicName" TEXT NOT NULL DEFAULT 'General',
      ADD COLUMN IF NOT EXISTS "question" TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "options" TEXT NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "correctAnswer" TEXT NOT NULL DEFAULT '';
    `);
    console.log("  ✓ Columns ensured.");

    // ─── 2. Backfill Mistake data from old Question FK if questionId column exists ───
    const checkQuestionIdCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Mistake' AND column_name = 'questionId';
    `);

    if (checkQuestionIdCol.rows.length > 0) {
      console.log("\n[2] Backfilling Mistake data from old Question FK...");
      const backfill = await client.query(`
        UPDATE "Mistake" m
        SET 
          "question" = COALESCE(NULLIF(q."question", ''), m."question"),
          "options" = COALESCE(NULLIF(q."options", ''), m."options"),
          "correctAnswer" = COALESCE(NULLIF(q."correctAnswer", ''), m."correctAnswer"),
          "subjectName" = COALESCE(NULLIF(s."name", ''), m."subjectName", 'General'),
          "topicName" = COALESCE(NULLIF(t."name", ''), m."topicName", 'General')
        FROM "Question" q
        LEFT JOIN "Subject" s ON q."subjectId" = s."id"
        LEFT JOIN "Topic" t ON q."topicId" = t."id"
        WHERE m."questionId" = q."id";
      `);
      console.log(`  ✓ Backfilled ${backfill.rowCount} mistake records.`);

      // Drop all foreign keys on Mistake, then drop questionId column
      console.log("  Dropping old questionId FK on Mistake...");
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'Mistake' 
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'questionId'
          ) LOOP
            EXECUTE 'ALTER TABLE "Mistake" DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '"';
          END LOOP;
        END $$;
      `);

      await client.query(`
        ALTER TABLE "Mistake" DROP COLUMN IF EXISTS "questionId";
      `);
      console.log("  ✓ questionId column removed.");

      // Re-add userId and sessionId FKs if they were dropped
      // (They should already exist via original schema, but ensure they're safe)
    } else {
      console.log("\n[2] No old questionId FK found on Mistake table — skipping backfill.");
    }

    // ─── 3. Drop questionRefId on Attempt if exists ───
    const checkAttemptRefCol = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Attempt' AND column_name = 'questionRefId';
    `);

    if (checkAttemptRefCol.rows.length > 0) {
      console.log("\n[3] Dropping old questionRefId column on Attempt...");
      await client.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'Attempt' 
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = 'questionRefId'
          ) LOOP
            EXECUTE 'ALTER TABLE "Attempt" DROP CONSTRAINT IF EXISTS "' || r.constraint_name || '"';
          END LOOP;
        END $$;
      `);
      await client.query(`ALTER TABLE "Attempt" DROP COLUMN IF EXISTS "questionRefId";`);
      console.log("  ✓ questionRefId column removed from Attempt.");
    } else {
      console.log("\n[3] No questionRefId column on Attempt — skipping.");
    }

    // ─── 4. Delete corrected/empty mistakes ───
    console.log("\n[4] Deleting corrected or empty mistake records...");
    const delMistakes = await client.query(`
      DELETE FROM "Mistake" WHERE "isCorrected" = TRUE OR "question" = '';
    `);
    console.log(`  ✓ Deleted ${delMistakes.rowCount} corrected/empty mistakes.`);

    // ─── 5. Prune Attempt records older than 1 hour (ephemeral review period) ───
    console.log("\n[5] Pruning Attempt records for sessions older than 1 hour...");
    const delAttempts = await client.query(`
      DELETE FROM "Attempt"
      WHERE "sessionId" IN (
        SELECT "id" FROM "Session"
        WHERE "createdAt" < NOW() - INTERVAL '1 hour'
      );
    `);
    console.log(`  ✓ Pruned ${delAttempts.rowCount} expired Attempt records.`);

    // ─── 6. Clean up auto-polluted Question Bank ───
    // The user explicitly stated: only manually saved questions should remain in the 
    // Question table. All questions previously auto-inserted from session/mistakes
    // should be removed.
    //
    // Since there is currently no flag to distinguish "manually saved" vs "auto-inserted",
    // and the user confirmed ALL existing questions were auto-inserted (not manually saved),
    // we delete ALL current questions to give a clean slate.
    //
    // Going forward, only saveQuestionsFromSession (user-triggered) inserts into Question.
    console.log("\n[6] Cleaning up auto-polluted Question Bank...");
    const qCountBefore = await client.query(`SELECT COUNT(*) FROM "Question"`);
    console.log(`  Questions before cleanup: ${qCountBefore.rows[0].count}`);

    const deletedQ = await client.query(`DELETE FROM "Question";`);
    console.log(`  ✓ Deleted ${deletedQ.rowCount} auto-polluted questions. Question Bank is now pristine.`);

    // Clean up orphan Topics and Subjects that have 0 questions now
    console.log("\n[7] Cleaning up orphan Topics/Subjects with 0 questions...");
    const delTopics = await client.query(`
      DELETE FROM "Topic" 
      WHERE "id" NOT IN (SELECT DISTINCT "topicId" FROM "Question");
    `);
    const delSubjects = await client.query(`
      DELETE FROM "Subject"
      WHERE "id" NOT IN (SELECT DISTINCT "subjectId" FROM "Question");
    `);
    console.log(`  ✓ Deleted ${delTopics.rowCount} orphan topics.`);
    console.log(`  ✓ Deleted ${delSubjects.rowCount} orphan subjects.`);

    // ─── Final verification ───
    const finalStats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "User") as user_count,
        (SELECT COUNT(*) FROM "Session") as session_count,
        (SELECT COUNT(*) FROM "Attempt") as attempt_count,
        (SELECT COUNT(*) FROM "Mistake") as mistake_count,
        (SELECT COUNT(*) FROM "Question") as question_count,
        (SELECT COUNT(*) FROM "Subject") as subject_count,
        (SELECT COUNT(*) FROM "Topic") as topic_count,
        (SELECT COUNT(*) FROM "CoinTransaction") as transaction_count;
    `);
    console.log("\n✅ Final database statistics:");
    console.table(finalStats.rows[0]);

    console.log("\n🎉 Migration and cleanup completed successfully!");
    console.log("   - Sessions, XP, coins, and accuracy are preserved.");
    console.log("   - Attempt records are pruned (ephemeral 1-hour review enforced).");
    console.log("   - Question Bank is now pristine (only manual saves going forward).");
    console.log("   - Mistakes are self-contained (no more Question FK dependency).");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
