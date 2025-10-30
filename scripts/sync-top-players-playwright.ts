/**
 * Sync Top 10 Players Per UCL Team using SoFIFA Playwright Scraper
 * - Scrapes player data directly from SoFIFA website
 * - Downloads player face images to client/public/player-images/
 * - Updates database with overall ratings, attributes, and image paths
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

// UCL Team search terms for SoFIFA
const UCL_TEAMS = [
  { name: 'Manchester City FC', search: 'Manchester City' },
  { name: 'Liverpool FC', search: 'Liverpool' },
  { name: 'Arsenal FC', search: 'Arsenal' },
  { name: 'Chelsea FC', search: 'Chelsea' },
  { name: 'Real Madrid CF', search: 'Real Madrid' },
  { name: 'FC Barcelona', search: 'Barcelona' },
  { name: 'Club Atlético de Madrid', search: 'Atletico Madrid' },
  { name: 'FC Bayern München', search: 'Bayern Munich' },
  { name: 'Borussia Dortmund', search: 'Dortmund' },
  { name: 'Bayer 04 Leverkusen', search: 'Leverkusen' },
  { name: 'FC Internazionale Milano', search: 'Inter' },
  { name: 'Juventus FC', search: 'Juventus' },
  { name: 'SSC Napoli', search: 'Napoli' },
  { name: 'Atalanta BC', search: 'Atalanta' },
  { name: 'Paris Saint-Germain FC', search: 'PSG' },
  { name: 'AS Monaco FC', search: 'Monaco' },
  { name: 'Sport Lisboa e Benfica', search: 'Benfica' },
  { name: 'Sporting Clube de Portugal', search: 'Sporting CP' },
  { name: 'PSV', search: 'PSV' },
  { name: 'Club Brugge KV', search: 'Club Brugge' },
];

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
    console.log(`    ⚠️  Could not download image for ${playerName}`);
    return null;
  }
}

function mapPosition(sofifaPosition: string): string {
  const pos = sofifaPosition.toUpperCase();
  
  if (pos.includes('GK')) return 'GK';
  if (pos.includes('CB') || pos.includes('LB') || pos.includes('RB') || 
      pos.includes('LWB') || pos.includes('RWB')) return 'DEF';
  if (pos.includes('CM') || pos.includes('CDM') || pos.includes('CAM') || 
      pos.includes('LM') || pos.includes('RM')) return 'MID';
  if (pos.includes('ST') || pos.includes('CF') || pos.includes('LW') || 
      pos.includes('RW')) return 'FWD';
  
  return 'MID'; // default
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

async function searchTeamPlayers(teamSearch: string): Promise<string[]> {
  // Search SoFIFA for team players
  const searchUrl = `https://sofifa.com/teams?keyword=${encodeURIComponent(teamSearch)}`;
  
  console.log(`    🔍 Searching: ${searchUrl}`);
  
  try {
    // Use axios to get the team page
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });
    
    // Parse HTML to find team link (this is basic - ideally use cheerio)
    const html = response.data;
    const teamMatch = html.match(/href="(\/team\/\d+\/[^"]+)"/);
    
    if (!teamMatch) {
      console.log(`    ⚠️  Team not found in search results`);
      return [];
    }
    
    const teamUrl = `https://sofifa.com${teamMatch[1]}`;
    console.log(`    📍 Team page: ${teamUrl}`);
    
    // Get team page to find player links
    const teamResponse = await axios.get(teamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    });
    
    const teamHtml = teamResponse.data;
    
    // Extract player URLs from the team page
    const playerUrlRegex = /href="(\/player\/\d+\/[^"]+)"/g;
    const playerUrls: string[] = [];
    let match;
    
    while ((match = playerUrlRegex.exec(teamHtml)) !== null) {
      const playerUrl = `https://sofifa.com${match[1]}`;
      if (!playerUrls.includes(playerUrl)) {
        playerUrls.push(playerUrl);
      }
    }
    
    console.log(`    ✅ Found ${playerUrls.length} players`);
    return playerUrls.slice(0, 15); // Get top 15, we'll filter to top 10 by rating
    
  } catch (error: any) {
    console.error(`    ❌ Error searching team: ${error.message}`);
    return [];
  }
}

async function syncTopPlayersForTeam(dbTeamName: string, teamSearch: string): Promise<number> {
  console.log(`\n🏆 ${dbTeamName}`);
  
  // Search for team and get player URLs
  const playerUrls = await searchTeamPlayers(teamSearch);
  
  if (playerUrls.length === 0) {
    console.log(`  ⏭️  Skipping - no players found`);
    return 0;
  }

  console.log(`  🎯 Processing up to 10 best players`);

  let updated = 0;
  let created = 0;
  const playersData: any[] = [];

  // Scrape each player
  for (const playerUrl of playerUrls) {
    try {
      console.log(`    📡 Scraping: ${playerUrl}`);
      const sofifaPlayer = await sofifaScraper.scrapePlayer(playerUrl);
      
      if (!sofifaPlayer || !sofifaPlayer.overall) {
        console.log(`    ⚠️  Failed to scrape player data`);
        continue;
      }
      
      playersData.push({ ...sofifaPlayer, url: playerUrl });
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.error(`    ❌ Error scraping player: ${error.message}`);
      continue;
    }
  }

  // Sort by overall rating and take top 10
  playersData.sort((a, b) => (b.overall || 0) - (a.overall || 0));
  const topPlayers = playersData.slice(0, 10);

  console.log(`\n  💾 Saving ${topPlayers.length} players to database...`);

  for (const sofifaPlayer of topPlayers) {
    try {
      const fullName = sofifaPlayer.name || 'Unknown Player';
      const playerId = sofifaPlayer.player_id || sofifaPlayer.url.match(/\/player\/(\d+)/)?.[1] || 'unknown';
      
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

      // Check if player exists in database
      const existingPlayers = await db
        .select()
        .from(players)
        .where(
          sql`LOWER(${players.name}) = LOWER(${fullName})`
        );

      const mappedPosition = mapPosition(sofifaPlayer.club_position || 'CM');

      const playerData = {
        name: fullName,
        team: dbTeamName,
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
        
        console.log(`    ✏️  Updated: ${fullName} (${sofifaPlayer.overall} OVR)`);
        updated++;
      } else {
        await db.insert(players).values({
          id: `${dbTeamName.replace(/\s+/g, '_').toLowerCase()}_${playerId}`,
          ...playerData
        });
        
        console.log(`    ➕ Created: ${fullName} (${sofifaPlayer.overall} OVR)`);
        created++;
      }
    } catch (error: any) {
      console.error(`    ❌ Error saving player: ${error.message}`);
    }
  }

  console.log(`  ✅ Synced ${created + updated} players (${created} new, ${updated} updated)`);
  return created + updated;
}

async function main() {
  console.log("\n⚽ SYNCING TOP 10 UCL PLAYERS PER TEAM (Playwright Scraper)");
  console.log("=".repeat(70));

  console.log(`📋 Teams to process: ${UCL_TEAMS.length}`);
  console.log(`🎯 Target: Top 10 players per team\n`);

  let totalPlayers = 0;
  let successfulTeams = 0;

  for (const team of UCL_TEAMS) {
    try {
      const playersUpdated = await syncTopPlayersForTeam(team.name, team.search);
      
      if (playersUpdated > 0) {
        totalPlayers += playersUpdated;
        successfulTeams++;
      }
    } catch (error: any) {
      console.error(`\n❌ Error processing ${team.name}: ${error.message}`);
    }
  }

  // Close the scraper browser
  await sofifaScraper.close();

  console.log("\n" + "=".repeat(70));
  console.log(`✅ Sync Complete!`);
  console.log(`   Teams processed: ${successfulTeams}/${UCL_TEAMS.length}`);
  console.log(`   Total players synced: ${totalPlayers}`);
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
