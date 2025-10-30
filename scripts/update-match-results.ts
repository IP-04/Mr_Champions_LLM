/**
 * Manual script to update match results
 * Run this after UCL matchdays to populate results for training
 */

import { matchResultsService } from "../server/services/matchResults";

async function main() {
  console.log("\n⚽ Manual Match Results Update");
  console.log("=".repeat(60));
  console.log("This will fetch finished match results from the API");
  console.log("and update the database for ML training.\n");

  try {
    // Update all finished matches
    await matchResultsService.updateFinishedMatches();

    // Show stats
    const stats = await matchResultsService.getTrainingDataStats();
    
    console.log("\n📊 Training Data Available:");
    console.log("=".repeat(60));
    console.log(`Total matches in database: ${stats.total}`);
    console.log(`Finished matches: ${stats.finished}`);
    console.log(`Scheduled matches: ${stats.scheduled}`);
    console.log(`Matches with results: ${stats.withResults}`);
    console.log("=".repeat(60));

    if (stats.withResults >= 10) {
      console.log("\n✅ You have enough data to train ML models!");
      console.log("   Run: npm run export-training-data");
      console.log("   Then: cd ml/python && python train_real_data.py");
    } else {
      console.log(`\n⚠️  Need at least 10 finished matches to train (currently: ${stats.withResults})`);
      console.log("   Wait for more UCL matches to finish or use synthetic data");
    }

    console.log("");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Update failed:", error);
    process.exit(1);
  }
}

main();
