/**
 * Import finished UCL matches from API into database
 * This adds historical matches with results for ML training
 */

import { db } from "../db";
import { matches } from "../shared/schema";
import { eq } from "drizzle-orm";
import { footballDataApi } from "../server/services/footballDataApi";
import { predictionService } from "../server/services/predictionService";

async function importFinishedMatches() {
  console.log("\n⚽ Importing Finished UCL Matches");
  console.log("=".repeat(60));

  try {
    // Get all matches from API
    const apiMatches = await footballDataApi.getAllMatches();
    
    // Filter for finished matches only
    const finishedMatches = apiMatches.filter((m: any) => m.status === "FINISHED");
    
    console.log(`\n📊 Found ${finishedMatches.length} finished matches in API`);
    
    if (finishedMatches.length === 0) {
      console.log("No finished matches to import");
      return;
    }

    let imported = 0;
    let skipped = 0;

    for (const apiMatch of finishedMatches) {
      const matchId = `match-${apiMatch.id}`;
      
      // Check if already exists
      const existing = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchId));

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Extract match data
      const homeGoals = apiMatch.score?.fullTime?.home;
      const awayGoals = apiMatch.score?.fullTime?.away;
      
      if (homeGoals === null || homeGoals === undefined || 
          awayGoals === null || awayGoals === undefined) {
        console.log(`⚠️  Skipping ${matchId}: Missing score data`);
        continue;
      }

      const matchDate = new Date(apiMatch.utcDate);
      const dateStr = matchDate.toISOString().split("T")[0];
      const timeStr = matchDate.toTimeString().slice(0, 5);

      // Generate default predictions (simple baseline)
      // We'll use equal probabilities since we don't have historical context
      const prediction = {
        homeWinProb: 0.40,
        drawProb: 0.30,
        awayWinProb: 0.30,
        homeXg: 1.5,
        awayXg: 1.5,
        confidence: 0.5
      };

      // Insert match with actual results
      await db.insert(matches).values({
        id: matchId,
        homeTeam: apiMatch.homeTeam.name,
        awayTeam: apiMatch.awayTeam.name,
        homeTeamCrest: apiMatch.homeTeam.crest,
        awayTeamCrest: apiMatch.awayTeam.crest,
        date: dateStr,
        time: timeStr,
        venue: "TBD", // API doesn't always provide venue
        stage: apiMatch.stage,
        
        // Our predictions (for comparison)
        homeWinProb: prediction.homeWinProb,
        drawProb: prediction.drawProb,
        awayWinProb: prediction.awayWinProb,
        homeXg: prediction.homeXg,
        awayXg: prediction.awayXg,
        confidence: prediction.confidence,
        
        // Actual results
        status: "FINISHED",
        homeGoals: homeGoals,
        awayGoals: awayGoals,
      });

      imported++;
      console.log(
        `✅ ${apiMatch.homeTeam.shortName} ${homeGoals}-${awayGoals} ${apiMatch.awayTeam.shortName} (${dateStr})`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Import Summary:");
    console.log(`   ✅ Imported: ${imported} finished matches`);
    console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
    console.log("=".repeat(60));

    // Show final stats
    const allMatches = await db.select().from(matches);
    const finishedCount = allMatches.filter(m => m.status === "FINISHED").length;
    const withResults = allMatches.filter(m => m.homeGoals !== null).length;

    console.log("\n📊 Database Status:");
    console.log(`   Total matches: ${allMatches.length}`);
    console.log(`   Finished matches: ${finishedCount}`);
    console.log(`   Matches with results: ${withResults}`);

    if (withResults >= 10) {
      console.log("\n✅ You now have enough data to train ML models!");
      console.log("   Next steps:");
      console.log("   1. Run: npm run export-training-data");
      console.log("   2. Then: cd ml/python && python train_real_data.py");
    }

    console.log("");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  }
}

importFinishedMatches();
