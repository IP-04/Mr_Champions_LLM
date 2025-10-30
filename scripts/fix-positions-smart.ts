/**
 * Smart Position Fixer
 * Uses player names and better logic to correctly classify positions
 */

import { db } from "../db/index.js";
import { players } from "../shared/schema.js";
import { eq } from "drizzle-orm";

// Known player positions (from real football knowledge)
const KNOWN_POSITIONS: Record<string, { position: string; statType: string }> = {
  // Liverpool
  "Alisson": { position: "GK", statType: "Saves" },
  "Alisson Ramses Becker": { position: "GK", statType: "Saves" },
  "Giorgi Mamardashvili": { position: "GK", statType: "Saves" },
  "V. van Dijk": { position: "DEF", statType: "Tackles" },
  "Ibrahima Konate": { position: "DEF", statType: "Tackles" },
  "Trent Alexander Arnold": { position: "DEF", statType: "Tackles" },
  "Andrew Robertson": { position: "DEF", statType: "Tackles" },
  "Alexis Mac Allister": { position: "MID", statType: "Assists" },
  "R. Gravenberch": { position: "MID", statType: "Assists" },
  "Dominik Szoboszlai": { position: "MID", statType: "Assists" },
  "Curtis Jones": { position: "MID", statType: "Assists" },
  "Mohamed Salah": { position: "FWD", statType: "Goals" },
  "Darwin Nunez": { position: "FWD", statType: "Goals" },
  "Luis Diaz": { position: "FWD", statType: "Goals" },
  "C. Gakpo": { position: "FWD", statType: "Goals" },
  "Diogo Jota": { position: "FWD", statType: "Goals" },
  
  // Real Madrid
  "T. Courtois": { position: "GK", statType: "Saves" },
  "A. Lunin": { position: "GK", statType: "Saves" },
  "Antonio Rudiger": { position: "DEF", statType: "Tackles" },
  "Eder Gabriel Militao": { position: "DEF", statType: "Tackles" },
  "F. Mendy": { position: "DEF", statType: "Tackles" },
  "D. Carvajal": { position: "DEF", statType: "Tackles" },
  "E. Camavinga": { position: "MID", statType: "Assists" },
  "A. Tchouameni": { position: "MID", statType: "Assists" },
  "Federico Valverde": { position: "MID", statType: "Assists" },
  "L. Modric": { position: "MID", statType: "Assists" },
  "Jude Bellingham": { position: "MID", statType: "Assists" },
  "Kylian Mbappe": { position: "FWD", statType: "Goals" },
  "Vinicius Jose De Oliveira Junior": { position: "FWD", statType: "Goals" },
  "Vinicius Jr": { position: "FWD", statType: "Goals" },
  "Rodrygo Silva De Goes": { position: "FWD", statType: "Goals" },
  "Rodrygo": { position: "FWD", statType: "Goals" },
  
  // Other top teams
  "Erling Haaland": { position: "FWD", statType: "Goals" },
  "Phil Foden": { position: "MID", statType: "Assists" },
  "Kevin De Bruyne": { position: "MID", statType: "Assists" },
  "Ederson": { position: "GK", statType: "Saves" },
  "Harry Kane": { position: "FWD", statType: "Goals" },
  "Leroy Sane": { position: "FWD", statType: "Goals" },
  "Joshua Kimmich": { position: "MID", statType: "Assists" },
  "Manuel Neuer": { position: "GK", statType: "Saves" },
  "A. Isak": { position: "FWD", statType: "Goals" },
  "F. Wirtz": { position: "FWD", statType: "Goals" },
  "Florian Wirtz": { position: "FWD", statType: "Goals" },
  
  // More Goalkeepers (critical to catch these!)
  "M. Perin": { position: "GK", statType: "Saves" },
  "M. ter Stegen": { position: "GK", statType: "Saves" },
  "G. Vicario": { position: "GK", statType: "Saves" },
  "Y. Sommer": { position: "GK", statType: "Saves" },
  "N. Olij": { position: "GK", statType: "Saves" },
  "L. Junior": { position: "GK", statType: "Saves" },
  "S. Esquivel": { position: "GK", statType: "Saves" },
  "I. Grbic": { position: "GK", statType: "Saves" },
  "A. Onana": { position: "GK", statType: "Saves" },
  "G. Donnarumma": { position: "GK", statType: "Saves" },
  "M. Maignan": { position: "GK", statType: "Saves" },
  "Oblak": { position: "GK", statType: "Saves" },
  "Jan Oblak": { position: "GK", statType: "Saves" },
};

async function fixPositionsSmart() {
  console.log("\n⚽ SMART POSITION FIXER");
  console.log("=".repeat(70));
  
  const allPlayers = await db.select().from(players);
  console.log(`\n📊 Checking ${allPlayers.length} players...`);
  
  let updatedCount = 0;
  
  for (const player of allPlayers) {
    // Check if we have a known position for this player
    const knownPosition = KNOWN_POSITIONS[player.name];
    
    if (knownPosition) {
      const needsUpdate = 
        player.position !== knownPosition.position ||
        player.statType !== knownPosition.statType;
      
      if (needsUpdate) {
        await db
          .update(players)
          .set({
            position: knownPosition.position,
            statType: knownPosition.statType,
          })
          .where(eq(players.id, player.id));
        
        console.log(`   ✅ Fixed ${player.name}: ${player.position} → ${knownPosition.position}, statType: ${knownPosition.statType}`);
        updatedCount++;
      }
    } else {
      // For unknown players, use smarter inference
      const radarStats = player.radarStats as any;
      if (radarStats && typeof radarStats === 'object') {
        const defending = radarStats.defending || 0;
        const shooting = radarStats.shooting || 0;
        const passing = radarStats.passing || 0;
        const pace = radarStats.pace || 0;
        
        let inferredPosition = player.position;
        let inferredStatType = player.statType;
        
        // CHECK FOR GOALKEEPER FIRST (they have unique stat profiles)
        // Goalkeepers typically have LOW shooting (<50) and LOW pace (<60)
        if (shooting < 50 && pace < 60 && (player.position === 'GK' || player.name.toLowerCase().includes('ter stegen') || player.name.toLowerCase().includes('perin'))) {
          inferredPosition = 'GK';
          inferredStatType = 'Saves';
        }
        // Better position inference for outfield players
        else if (shooting >= 75 && pace >= 70 && defending < 65) {
          // Fast shooter = Forward
          inferredPosition = 'FWD';
          inferredStatType = 'Goals';
        } else if (defending >= 75 && shooting < 65) {
          // High defending, low shooting = Defender
          inferredPosition = 'DEF';
          inferredStatType = 'Tackles';
        } else if (passing >= 75 || (defending >= 60 && defending < 75)) {
          // Good passer or moderate defending = Midfielder
          inferredPosition = 'MID';
          inferredStatType = 'Assists';
        }
        
        if (player.position !== inferredPosition || player.statType !== inferredStatType) {
          await db
            .update(players)
            .set({
              position: inferredPosition,
              statType: inferredStatType,
            })
            .where(eq(players.id, player.id));
          
          console.log(`   🔄 Inferred ${player.name}: ${player.position} → ${inferredPosition}, statType: ${inferredStatType}`);
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} players`);
  console.log("=".repeat(70));
}

async function main() {
  try {
    await fixPositionsSmart();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

