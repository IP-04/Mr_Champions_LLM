/**
 * Backfill Historical UCL Match Results
 * Fetches finished matches from Football Data API and updates database with actual scores
 */

import { db } from "../db";
import { matches } from "../shared/schema";
import { eq } from "drizzle-orm";

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const UCL_COMPETITION_CODE = "CL"; // Champions League
const SEASON = "2024"; // 2024-25 season

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    duration: string;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
}

async function fetchFinishedMatches(): Promise<FootballDataMatch[]> {
  console.log(`\n🔍 Fetching UCL ${SEASON} matches from Football Data API...`);

  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${UCL_COMPETITION_CODE}/matches?season=${SEASON}`,
    {
      headers: {
        "X-Auth-Token": FOOTBALL_DATA_API_KEY || "",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const finishedMatches = data.matches.filter(
    (match: FootballDataMatch) => match.status === "FINISHED"
  );

  console.log(`✅ Found ${finishedMatches.length} finished matches\n`);
  return finishedMatches;
}

async function backfillMatchResults() {
  console.log("⚽ UCL Match Results Backfill");
  console.log("=".repeat(60));

  try {
    // Fetch finished matches from API
    const finishedMatches = await fetchFinishedMatches();

    if (finishedMatches.length === 0) {
      console.log("ℹ️  No finished matches found for this season yet");
      return;
    }

    let updated = 0;
    let notFound = 0;
    let alreadyUpdated = 0;

    for (const apiMatch of finishedMatches) {
      const homeGoals = apiMatch.score.fullTime.home;
      const awayGoals = apiMatch.score.fullTime.away;

      // Skip if score data is missing
      if (homeGoals === null || awayGoals === null) {
        console.log(`⚠️  Skipping match ${apiMatch.id}: Missing score data`);
        continue;
      }

      // Find matching record in our database
      // We match by team names and date
      const matchDate = new Date(apiMatch.utcDate).toISOString().split("T")[0];
      
      const existingMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.date, matchDate));

      // Find the match by team names
      const dbMatch = existingMatches.find(
        (m) =>
          (m.homeTeam.includes(apiMatch.homeTeam.name) ||
            m.homeTeam.includes(apiMatch.homeTeam.shortName) ||
            m.homeTeam.includes(apiMatch.homeTeam.tla)) &&
          (m.awayTeam.includes(apiMatch.awayTeam.name) ||
            m.awayTeam.includes(apiMatch.awayTeam.shortName) ||
            m.awayTeam.includes(apiMatch.awayTeam.tla))
      );

      if (!dbMatch) {
        notFound++;
        console.log(
          `⚠️  No database match found for: ${apiMatch.homeTeam.name} vs ${apiMatch.awayTeam.name} (${matchDate})`
        );
        continue;
      }

      // Check if already updated
      if (dbMatch.homeGoals !== null && dbMatch.awayGoals !== null) {
        alreadyUpdated++;
        continue;
      }

      // Update the match with actual results
      await db
        .update(matches)
        .set({
          status: "FINISHED",
          homeGoals: homeGoals,
          awayGoals: awayGoals,
          // Note: Football Data API doesn't provide xG data
          // We'll keep our predicted xG values for now
        })
        .where(eq(matches.id, dbMatch.id));

      updated++;
      console.log(
        `✅ Updated: ${dbMatch.homeTeam} ${homeGoals}-${awayGoals} ${dbMatch.awayTeam}`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Backfill Summary:");
    console.log(`   ✅ Updated: ${updated} matches`);
    console.log(`   ℹ️  Already had results: ${alreadyUpdated} matches`);
    console.log(`   ⚠️  Not found in database: ${notFound} matches`);
    console.log(`   📝 Total finished matches in API: ${finishedMatches.length}`);
    console.log("=".repeat(60) + "\n");

    // Show sample of updated matches
    const finishedInDb = await db
      .select()
      .from(matches)
      .where(eq(matches.status, "FINISHED"))
      .limit(5);

    if (finishedInDb.length > 0) {
      console.log("📋 Sample of finished matches in database:");
      for (const match of finishedInDb) {
        console.log(
          `   ${match.homeTeam} ${match.homeGoals}-${match.awayGoals} ${match.awayTeam} (${match.date})`
        );
      }
      console.log("");
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  }
}

// Run the backfill
backfillMatchResults();
