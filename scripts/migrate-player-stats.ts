import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🔄 Running database migration...');
  
  try {
    // Add radar_stats column
    await db.execute(sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS radar_stats jsonb
    `);
    
    // Add sofifa_id column
    await db.execute(sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS sofifa_id text
    `);
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
