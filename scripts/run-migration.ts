/**
 * Manual migration script to add match result columns
 * Run this when drizzle-kit push times out
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

async function runMigration() {
  console.log("\n🔧 Running migration: Add match result columns");
  console.log("=".repeat(60));

  try {
    // Add columns if they don't exist
    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
    `);
    console.log("✅ Added 'status' column");

    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS home_goals INTEGER
    `);
    console.log("✅ Added 'home_goals' column");

    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS away_goals INTEGER
    `);
    console.log("✅ Added 'away_goals' column");

    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS actual_home_xg REAL
    `);
    console.log("✅ Added 'actual_home_xg' column");

    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS actual_away_xg REAL
    `);
    console.log("✅ Added 'actual_away_xg' column");

    // Create index on status
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)
    `);
    console.log("✅ Created index on 'status' column");

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60) + "\n");

    // Verify columns exist
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'matches'
      AND column_name IN ('status', 'home_goals', 'away_goals', 'actual_home_xg', 'actual_away_xg')
      ORDER BY column_name
    `);

    console.log("\n📋 Verified columns:");
    console.table(result.rows);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
