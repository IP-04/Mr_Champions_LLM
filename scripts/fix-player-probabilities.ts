/**
 * Fix Player Probabilities
 * Normalizes all player stat probabilities to 0-1 range
 * Fixes the 4600% bug and other probability issues
 */

import { db } from "../db";
import { players } from "../shared/schema";
import { sql } from "drizzle-orm";

async function fixPlayerProbabilities() {
  console.log("\n🔧 FIXING PLAYER PROBABILITIES");
  console.log("=".repeat(60));

  // Get all players
  const allPlayers = await db.select().from(players);

  console.log(`📊 Found ${allPlayers.length} players to check`);

  let fixed = 0;
  let alreadyCorrect = 0;

  for (const player of allPlayers) {
    const oldProb = player.statProbability;
    let newProb = oldProb;

    // Fix if probability is > 1 (likely shown as percentage)
    if (oldProb > 1) {
      newProb = oldProb / 100;
      newProb = Math.min(1.0, Math.max(0.0, newProb));
    }

    // Ensure it's in valid range
    newProb = Math.min(1.0, Math.max(0.0, newProb));

    if (Math.abs(newProb - oldProb) > 0.0001) {
      // Update the player
      await db
        .update(players)
        .set({ statProbability: newProb })
        .where(sql`id = ${player.id}`);

      console.log(
        `  ✅ ${player.name} (${player.team}): ${(oldProb * 100).toFixed(0)}% → ${(newProb * 100).toFixed(1)}%`
      );
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Fixed: ${fixed} players`);
  console.log(`ℹ️  Already correct: ${alreadyCorrect} players`);
  console.log(`📊 Total: ${allPlayers.length} players`);

  // Show statistics
  const updatedPlayers = await db.select().from(players);
  const avgProb =
    updatedPlayers.reduce((sum, p) => sum + p.statProbability, 0) /
    updatedPlayers.length;
  const maxProb = Math.max(...updatedPlayers.map((p) => p.statProbability));
  const minProb = Math.min(...updatedPlayers.map((p) => p.statProbability));

  console.log("\n📈 Probability Statistics:");
  console.log(`   Average: ${(avgProb * 100).toFixed(1)}%`);
  console.log(`   Range: ${(minProb * 100).toFixed(1)}% - ${(maxProb * 100).toFixed(1)}%`);

  if (maxProb > 1.0) {
    console.log("\n⚠️  WARNING: Some probabilities still > 100%!");
  } else {
    console.log("\n✅ All probabilities now in valid range (0-100%)");
  }
}

fixPlayerProbabilities()
  .then(() => {
    console.log("\n✅ Probability fix complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
