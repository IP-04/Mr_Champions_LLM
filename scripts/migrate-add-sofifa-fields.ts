import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrateAddSofifaFields() {
  console.log("Starting migration: Adding SoFIFA fields to players table...");
  
  try {
    // Add new columns to players table
    await db.execute(sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS player_face_url TEXT,
      ADD COLUMN IF NOT EXISTS sofifa_url TEXT,
      ADD COLUMN IF NOT EXISTS overall INTEGER,
      ADD COLUMN IF NOT EXISTS potential INTEGER,
      ADD COLUMN IF NOT EXISTS preferred_foot TEXT,
      ADD COLUMN IF NOT EXISTS weak_foot TEXT,
      ADD COLUMN IF NOT EXISTS skill_moves TEXT,
      ADD COLUMN IF NOT EXISTS work_rate TEXT,
      ADD COLUMN IF NOT EXISTS last_scraped TIMESTAMP
    `);
    
    console.log("✅ Successfully added new SoFIFA fields to players table");
    console.log("   - player_face_url (TEXT)");
    console.log("   - sofifa_url (TEXT)");
    console.log("   - overall (INTEGER)");
    console.log("   - potential (INTEGER)");
    console.log("   - preferred_foot (TEXT)");
    console.log("   - weak_foot (TEXT)");
    console.log("   - skill_moves (TEXT)");
    console.log("   - work_rate (TEXT)");
    console.log("   - last_scraped (TIMESTAMP)");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateAddSofifaFields()
  .then(() => {
    console.log("\n✨ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration failed:", error);
    process.exit(1);
  });
