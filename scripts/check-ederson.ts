import { db } from "../db";
import { players } from "../shared/schema";
import { eq, like } from "drizzle-orm";

async function checkEderson() {
  try {
    console.log("🔍 Searching for Ederson in database...\n");
    
    const edersonPlayers = await db
      .select()
      .from(players)
      .where(like(players.name, '%Ederson%'));
    
    if (edersonPlayers.length === 0) {
      console.log("❌ No Ederson found in database");
      return;
    }
    
    for (const player of edersonPlayers) {
      console.log("==========================================");
      console.log("Player:", player.name);
      console.log("Team:", player.teamName);
      console.log("Overall:", player.overall);
      console.log("PlayerFaceUrl:", player.playerFaceUrl);
      console.log("SofifaUrl:", player.sofifaUrl);
      console.log("LastScraped:", player.lastScraped);
      console.log("ImageUrl (old):", player.imageUrl);
      console.log("ExpectedContribution:", player.expectedContribution);
      console.log("==========================================\n");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkEderson();
