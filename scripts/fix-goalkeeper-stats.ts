/**
 * Fix Goalkeeper Stats and Positions
 * Sets correct statType for GKs and ensures position is accurate
 */

import { db } from "../db/index.js";
import { players } from "../shared/schema.js";
import { eq, or, like, sql } from "drizzle-orm";

async function fixGoalkeeperStats() {
  console.log("\n⚽ FIXING GOALKEEPER STATS AND POSITIONS");
  console.log("=".repeat(70));
  
  // Find all goalkeepers (by radarStats or name patterns)
  const allPlayers = await db.select().from(players);
  
  console.log(`\n📊 Checking ${allPlayers.length} total players...`);
  
  let gkCount = 0;
  let defCount = 0;
  let midCount = 0;
  let fwdCount = 0;
  
  for (const player of allPlayers) {
    let updates: any = {};
    let needsUpdate = false;
    
    // Detect goalkeepers by name or current position
    const isGK = 
      player.name?.toLowerCase().includes('alisson') ||
      player.name?.toLowerCase().includes('courtois') ||
      player.name?.toLowerCase().includes('mamardashvili') ||
      player.name?.toLowerCase().includes('lunin') ||
      player.name?.toLowerCase().includes('ter stegen') ||
      player.name?.toLowerCase().includes('ederson') ||
      player.name?.toLowerCase().includes('oblak') ||
      player.name?.toLowerCase().includes('donnarumma') ||
      player.name?.toLowerCase().includes('neuer') ||
      player.name?.toLowerCase().includes('dibu') ||
      player.name?.toLowerCase().includes('martinez') && player.position === 'GK' ||
      player.name?.toLowerCase().includes('onana') ||
      player.position === 'GK';
    
    if (isGK) {
      // Fix GK position and statType
      if (player.position !== 'GK') {
        updates.position = 'GK';
        needsUpdate = true;
      }
      if (player.statType !== 'Saves') {
        updates.statType = 'Saves';
        needsUpdate = true;
      }
      gkCount++;
    } else {
      // Infer position from radarStats if available
      const radarStats = player.radarStats as any;
      if (radarStats && typeof radarStats === 'object') {
        const defending = radarStats.defending || 0;
        const shooting = radarStats.shooting || 0;
        const passing = radarStats.passing || 0;
        
        let inferredPosition = player.position;
        
        if (shooting >= 75 && defending < 60) {
          inferredPosition = 'FWD';
          fwdCount++;
        } else if (defending >= 70) {
          inferredPosition = 'DEF';
          defCount++;
        } else {
          inferredPosition = 'MID';
          midCount++;
        }
        
        if (player.position !== inferredPosition) {
          updates.position = inferredPosition;
          needsUpdate = true;
        }
        
        // Set appropriate statType based on position
        if (inferredPosition === 'FWD' && player.statType !== 'Goals') {
          updates.statType = 'Goals';
          needsUpdate = true;
        } else if (inferredPosition === 'DEF' && player.statType !== 'Tackles') {
          updates.statType = 'Tackles';
          needsUpdate = true;
        } else if (inferredPosition === 'MID' && !['Goals', 'Assists'].includes(player.statType || '')) {
          updates.statType = 'Assists';
          needsUpdate = true;
        }
      }
    }
    
    if (needsUpdate) {
      await db
        .update(players)
        .set(updates)
        .where(eq(players.id, player.id));
      
      console.log(`   ✅ Updated ${player.name}: position=${updates.position || player.position}, statType=${updates.statType || player.statType}`);
    }
  }
  
  console.log(`\n📊 Position Distribution:`);
  console.log(`   GK:  ${gkCount}`);
  console.log(`   DEF: ${defCount}`);
  console.log(`   MID: ${midCount}`);
  console.log(`   FWD: ${fwdCount}`);
  
  console.log(`\n✅ COMPLETE! All positions and statTypes fixed`);
  console.log("=".repeat(70));
}

async function main() {
  try {
    await fixGoalkeeperStats();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

