/**
 * Match Results Service
 * Automatically updates match results when matches finish
 */

import { db } from "../../db";
import { matches } from "@shared/schema";
import { eq } from "drizzle-orm";
import { footballDataApi } from "./footballDataApi";

export class MatchResultsService {
  /**
   * Update results for all finished matches
   * Call this periodically (e.g., daily or after matchdays)
   */
  async updateFinishedMatches(): Promise<void> {
    console.log("\n⚽ Updating match results...");
    console.log("=".repeat(60));

    try {
      // Get all matches from API
      const apiMatches = await footballDataApi.getAllMatches();

      // Filter for finished matches only
      const finishedMatches = apiMatches.filter(
        (match: any) => match.status === "FINISHED"
      );

      console.log(`Found ${finishedMatches.length} finished matches in API`);

      if (finishedMatches.length === 0) {
        console.log("No finished matches to update");
        return;
      }

      let updated = 0;
      let notFound = 0;
      let alreadyUpdated = 0;

      for (const apiMatch of finishedMatches) {
        const homeGoals = apiMatch.score?.fullTime?.home;
        const awayGoals = apiMatch.score?.fullTime?.away;

        // Skip if score data is missing
        if (homeGoals === null || homeGoals === undefined || 
            awayGoals === null || awayGoals === undefined) {
          continue;
        }

        // Try to find this match in our database
        // We'll match by date and team names
        const matchDate = new Date(apiMatch.utcDate).toISOString().split("T")[0];
        const matchId = `match-${apiMatch.id}`;

        // Check if match exists in database
        const existingMatches = await db
          .select()
          .from(matches)
          .where(eq(matches.id, matchId));

        if (existingMatches.length === 0) {
          notFound++;
          continue;
        }

        const dbMatch = existingMatches[0];

        // Check if already updated
        if (dbMatch.homeGoals !== null && dbMatch.awayGoals !== null) {
          alreadyUpdated++;
          continue;
        }

        // Update with actual results
        await db
          .update(matches)
          .set({
            status: "FINISHED",
            homeGoals: homeGoals,
            awayGoals: awayGoals,
            // Note: Football Data API doesn't provide xG
            // We keep the predicted xG values
          })
          .where(eq(matches.id, matchId));

        updated++;
        console.log(
          `✅ ${dbMatch.homeTeam} ${homeGoals}-${awayGoals} ${dbMatch.awayTeam}`
        );
      }

      console.log("\n" + "=".repeat(60));
      console.log("📊 Update Summary:");
      console.log(`   ✅ Updated: ${updated}`);
      console.log(`   ℹ️  Already had results: ${alreadyUpdated}`);
      console.log(`   ⚠️  Not in database: ${notFound}`);
      console.log("=".repeat(60) + "\n");

    } catch (error) {
      console.error("❌ Error updating match results:", error);
      throw error;
    }
  }

  /**
   * Get training data statistics
   * Shows how many finished matches we have for ML training
   */
  async getTrainingDataStats(): Promise<{
    total: number;
    finished: number;
    scheduled: number;
    withResults: number;
  }> {
    const allMatches = await db.select().from(matches);

    const stats = {
      total: allMatches.length,
      finished: allMatches.filter((m) => m.status === "FINISHED").length,
      scheduled: allMatches.filter((m) => m.status === "SCHEDULED").length,
      withResults: allMatches.filter((m) => m.homeGoals !== null && m.awayGoals !== null).length,
    };

    return stats;
  }
}

export const matchResultsService = new MatchResultsService();
