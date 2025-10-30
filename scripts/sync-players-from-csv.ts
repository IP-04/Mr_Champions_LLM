/**
 * Sync Players from Pre-collected SoFIFA URLs
 * Uses the player_urls.csv file with 18k+ player URLs
 * Filters to top 10 players per UCL team based on overall rating
 */

import { db } from "../db/index.js";
import { players } from "../shared/schema.js";
import { sql, eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { sofifaScraper } from "../server/services/sofifaPlaywrightScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// UCL Teams to filter for
const UCL_TEAMS = [
  'Manchester City', 'Liverpool', 'Arsenal', 'Chelsea',
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Athletic Club',
  'Bayern Munich', 'Dortmund', 'Leverkusen', 'Leipzig',
  'Inter', 'Juventus', 'Napoli', 'Milan', 'Atalanta',
  'PSG', 'Monaco', 'Marseille',
  'Benfica', 'Sporting CP', 'Porto',
  'PSV', 'Ajax', 'Feyenoord',
  'Club Brugge', 'Celtic',
  'Galatasaray', 'Fenerbahce',
];

interface PlayerWithUrl {
  url: string;
  name: string;
  team: string;
  overall: number;
  data: any;
}

async function downloadPlayerImage(imageUrl: string, playerId: string, playerName: string): Promise<string | null> {
  if (!imageUrl) return null;
  
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    const imageDir = path.join(__dirname, "..", "client", "public", "player-images");
    
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const sanitizedName = playerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filename = `${playerId}_${sanitizedName}.png`;
    const filepath = path.join(imageDir, filename);

    fs.writeFileSync(filepath, Buffer.from(response.data));
    
    return `/player-images/${filename}`;
  } catch (error) {
    return null;
  }
}

function mapPosition(sofifaPosition: string): string {
  if (!sofifaPosition) return 'MID';
  const pos = sofifaPosition.toUpperCase();
  
  if (pos.includes('GK')) return 'GK';
  if (pos.includes('CB') || pos.includes('LB') || pos.includes('RB') || 
      pos.includes('LWB') || pos.includes('RWB')) return 'DEF';
  if (pos.includes('CM') || pos.includes('CDM') || pos.includes('CAM') || 
      pos.includes('LM') || pos.includes('RM')) return 'MID';
  if (pos.includes('ST') || pos.includes('CF') || pos.includes('LW') || 
      pos.includes('RW')) return 'FWD';
  
  return 'MID';
}

function getStatTypeForPosition(position: string): string {
  const statMap: Record<string, string> = {
    'FWD': 'Goals',
    'MID': 'Assists',
    'DEF': 'Tackles',
    'GK': 'Saves'
  };
  return statMap[position] || 'Goals';
}

function calculateBaseExpectation(position: string, overall: number): number {
  const baseMap: Record<string, number> = {
    'FWD': (overall - 50) / 100,
    'MID': (overall - 55) / 120,
    'DEF': (overall - 60) / 80,
    'GK': (overall - 40) / 20
  };
  return Math.max(0.1, baseMap[position] || 0.2);
}

function isUCLTeam(teamName: string): boolean {
  if (!teamName) return false;
  const normalized = teamName.toLowerCase();
  return UCL_TEAMS.some(uclTeam => normalized.includes(uclTeam.toLowerCase()));
}

async function readPlayerUrls(): Promise<string[]> {
  const csvPath = path.join(__dirname, "..", "sofifa-web-scraper", "player_urls.csv");
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1); // Skip header
  return lines.map(line => line.trim()).filter(line => line.length > 0);
}

async function main() {
  console.log("\n⚽ SYNCING UCL PLAYERS FROM CSV");
  console.log("=".repeat(70));

  // Read player URLs from CSV
  const playerUrls = await readPlayerUrls();
  console.log(`📋 Total player URLs in CSV: ${playerUrls.length}`);
  console.log(`🎯 Filtering for UCL teams only\n`);

  const allPlayers: PlayerWithUrl[] = [];
  let scraped = 0;
  let skipped = 0;

  // Process first 200 players (to find UCL players)
  const urlsToProcess = playerUrls.slice(0, 200);
  console.log(`🔍 Scraping first ${urlsToProcess.length} players to find UCL teams...\n`);

  for (const playerUrl of urlsToProcess) {
    try {
      console.log(`  [${scraped + skipped + 1}/${urlsToProcess.length}] Scraping...`);
      const sofifaPlayer = await sofifaScraper.scrapePlayer(playerUrl);
      
      if (!sofifaPlayer || !sofifaPlayer.overall) {
        console.log(`    ⚠️  Failed to scrape or no overall rating`);
        skipped++;
        continue;
      }

      // Extract player name from URL if not available
      let playerName = sofifaPlayer.name;
      if (!playerName || playerName === 'Unknown') {
        const nameMatch = playerUrl.match(/\/player\/\d+\/([^\/]+)/);
        if (nameMatch) {
          playerName = nameMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        } else {
          playerName = 'Unknown Player';
        }
      }

      // Check if player is from a UCL team
      if (!isUCLTeam(sofifaPlayer.club_name || '')) {
        console.log(`    ⏭️  ${playerName} (${sofifaPlayer.club_name || 'Unknown'}) - Not UCL team`);
        skipped++;
        continue;
      }

      console.log(`    ✅ ${playerName} (${sofifaPlayer.club_name}) - ${sofifaPlayer.overall} OVR`);
      
      allPlayers.push({
        url: playerUrl,
        name: playerName,
        team: sofifaPlayer.club_name || 'Unknown',
        overall: sofifaPlayer.overall,
        data: { ...sofifaPlayer, name: playerName }
      });
      
      scraped++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.error(`    ❌ Error: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\n📊 Found ${allPlayers.length} UCL players from ${scraped} scraped`);

  // Group by team and get top 10 per team
  const teamPlayers: Record<string, PlayerWithUrl[]> = {};
  
  for (const player of allPlayers) {
    if (!teamPlayers[player.team]) {
      teamPlayers[player.team] = [];
    }
    teamPlayers[player.team].push(player);
  }

  // Sort each team's players by overall rating
  for (const team in teamPlayers) {
    teamPlayers[team].sort((a, b) => b.overall - a.overall);
  }

  console.log(`\n🏆 Teams found: ${Object.keys(teamPlayers).length}`);
  for (const team in teamPlayers) {
    console.log(`   ${team}: ${teamPlayers[team].length} players`);
  }

  // Save top 10 from each team to database
  console.log(`\n💾 Saving top 10 players per team to database...\n`);

  let totalSaved = 0;
  let totalUpdated = 0;
  let totalCreated = 0;

  for (const [teamName, teamPlayersList] of Object.entries(teamPlayers)) {
    console.log(`\n🏆 ${teamName}`);
    const top10 = teamPlayersList.slice(0, 10);
    
    for (const playerWithUrl of top10) {
      const sofifaPlayer = playerWithUrl.data;
      const fullName = sofifaPlayer.name;
      const playerId = playerWithUrl.url.match(/\/player\/(\d+)/)?.[1] || 'unknown';

      try {
        // Download player image
        let imagePath = null;
        if (sofifaPlayer.player_face_url) {
          imagePath = await downloadPlayerImage(sofifaPlayer.player_face_url, playerId, fullName);
        }

        // Calculate FIFA 6 attributes
        const pace = Math.round(((sofifaPlayer.movement_acceleration || 0) + (sofifaPlayer.movement_sprint_speed || 0)) / 2);
        const shooting = Math.round(((sofifaPlayer.attacking_finishing || 0) + (sofifaPlayer.power_shot_power || 0)) / 2);
        const passing = Math.round(((sofifaPlayer.attacking_short_passing || 0) + (sofifaPlayer.skill_long_passing || 0)) / 2);
        const dribbling = Math.round(((sofifaPlayer.skill_dribbling || 0) + (sofifaPlayer.skill_ball_control || 0)) / 2);
        const defending = Math.round(((sofifaPlayer.defending_defensive_awareness || 0) + (sofifaPlayer.defending_standing_tackle || 0)) / 2);
        const physical = Math.round(((sofifaPlayer.power_strength || 0) + (sofifaPlayer.power_stamina || 0)) / 2);

        // Check if player exists
        const existingPlayers = await db
          .select()
          .from(players)
          .where(sql`LOWER(${players.name}) = LOWER(${fullName})`);

        const mappedPosition = mapPosition(sofifaPlayer.club_position || 'CM');

        const playerData = {
          name: fullName,
          team: teamName,
          position: mappedPosition,
          imageUrl: imagePath || '/player-images/default-player.png',
          playerFaceUrl: imagePath,
          overall: sofifaPlayer.overall || 75,
          potential: sofifaPlayer.potential || sofifaPlayer.overall || 75,
          radarStats: {
            pace,
            shooting,
            passing,
            dribbling,
            defending,
            physical
          },
          sofifaId: playerId,
          preferredFoot: sofifaPlayer.preferred_foot || 'Right',
          weakFoot: sofifaPlayer.weak_foot || '3',
          skillMoves: sofifaPlayer.skill_moves || '3',
          expectedContribution: calculateBaseExpectation(mappedPosition, sofifaPlayer.overall || 75),
          predictedMinutes: 85,
          statProbability: 0.35,
          statType: getStatTypeForPosition(mappedPosition),
          last5Avg: calculateBaseExpectation(mappedPosition, sofifaPlayer.overall || 75),
          stat90: calculateBaseExpectation(mappedPosition, sofifaPlayer.overall || 75) * 1.1,
        };

        if (existingPlayers.length > 0) {
          await db
            .update(players)
            .set(playerData)
            .where(eq(players.id, existingPlayers[0].id));
          
          console.log(`  ✏️  Updated: ${fullName} (${sofifaPlayer.overall} OVR)`);
          totalUpdated++;
        } else {
          await db.insert(players).values({
            id: `${teamName.replace(/\s+/g, '_').toLowerCase()}_${playerId}`,
            ...playerData
          });
          
          console.log(`  ➕ Created: ${fullName} (${sofifaPlayer.overall} OVR)`);
          totalCreated++;
        }

        totalSaved++;

      } catch (error: any) {
        console.error(`  ❌ Error saving ${fullName}: ${error.message}`);
      }
    }
  }

  // Close the scraper
  await sofifaScraper.close();

  console.log("\n" + "=".repeat(70));
  console.log(`✅ Sync Complete!`);
  console.log(`   Players scraped: ${scraped}`);
  console.log(`   UCL players found: ${allPlayers.length}`);
  console.log(`   Teams found: ${Object.keys(teamPlayers).length}`);
  console.log(`   Players saved: ${totalSaved} (${totalCreated} new, ${totalUpdated} updated)`);
  console.log(`   Images saved to: client/public/player-images/`);
  console.log("\n🎯 Next Steps:");
  console.log("   1. Train player prediction ML models");
  console.log("   2. Run: cd ml/python && python train_player_predictions.py");
}

main()
  .then(() => {
    console.log("\n✅ Player sync complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
