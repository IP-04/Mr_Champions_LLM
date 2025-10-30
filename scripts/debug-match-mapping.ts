/**
 * Debug: Check match ID mapping between database and API
 */

import { db } from "../db";
import { matches } from "../shared/schema";
import { footballDataApi } from "../server/services/footballDataApi";

async function debugMatchMapping() {
  console.log("\n🔍 Debugging Match ID Mapping");
  console.log("=".repeat(60));

  // Get matches from database
  const dbMatches = await db.select().from(matches).limit(5);
  
  console.log("\n📋 Database Matches (first 5):");
  for (const match of dbMatches) {
    console.log(`ID: ${match.id}`);
    console.log(`   ${match.homeTeam} vs ${match.awayTeam}`);
    console.log(`   Date: ${match.date}, Status: ${match.status}`);
    console.log("");
  }

  // Get matches from API
  const apiMatches = await footballDataApi.getAllMatches();
  const finishedApiMatches = apiMatches.filter((m: any) => m.status === "FINISHED").slice(0, 5);

  console.log("\n📡 API Finished Matches (first 5):");
  for (const match of finishedApiMatches) {
    console.log(`ID: match-${match.id} (API ID: ${match.id})`);
    console.log(`   ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    console.log(`   Date: ${new Date(match.utcDate).toISOString().split('T')[0]}`);
    console.log(`   Score: ${match.score.fullTime.home}-${match.score.fullTime.away}`);
    console.log("");
  }

  // Check for potential matches
  console.log("\n🔍 Checking for Match Overlaps:");
  for (const dbMatch of dbMatches) {
    const apiMatchId = dbMatch.id.replace("match-", "");
    const apiMatch = apiMatches.find((m: any) => m.id.toString() === apiMatchId);
    
    if (apiMatch) {
      console.log(`✅ Found API match for ${dbMatch.id}`);
      console.log(`   DB: ${dbMatch.homeTeam} vs ${dbMatch.awayTeam} (${dbMatch.date})`);
      console.log(`   API: ${apiMatch.homeTeam.name} vs ${apiMatch.awayTeam.name} (${new Date(apiMatch.utcDate).toISOString().split('T')[0]})`);
      console.log(`   Status: ${apiMatch.status}`);
      if (apiMatch.status === "FINISHED") {
        console.log(`   Score: ${apiMatch.score.fullTime.home}-${apiMatch.score.fullTime.away}`);
      }
      console.log("");
    } else {
      console.log(`⚠️  No API match found for DB ID: ${dbMatch.id}`);
    }
  }

  process.exit(0);
}

debugMatchMapping();
