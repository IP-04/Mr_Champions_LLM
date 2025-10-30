/**
 * Check what matches are in the database
 */

import { db } from "../db";
import { matches } from "../shared/schema";

async function checkMatches() {
  console.log("\n📋 Checking matches in database...\n");

  const allMatches = await db.select().from(matches).limit(10);

  console.log(`Total matches in database: ${allMatches.length} (showing first 10)`);
  console.log("\n");

  for (const match of allMatches) {
    console.log(`${match.id}: ${match.homeTeam} vs ${match.awayTeam}`);
    console.log(`   Date: ${match.date}`);
    console.log(`   Status: ${match.status || 'SCHEDULED'}`);
    console.log(`   Score: ${match.homeGoals ?? '-'} - ${match.awayGoals ?? '-'}`);
    console.log("");
  }

  process.exit(0);
}

checkMatches();
