/**
 * Sync Top 10 Players Per UCL Team from SoFIFA
 * - Fetches best players (by overall rating) for each Champions League team  
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SoFIFA API configuration
const SOFIFA_API_BASE = "https://api.sofifa.net";

interface SoFIFAPlayer {
  id: number;
  firstName: string;
  lastName: string;
  commonName: string;
  overallRating: number;
  potential: number;
  age: number;
  position1: number;
  position2?: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  playerFaceUrl?: string;
  preferredFoot?: string;
  weakFoot?: number;
  skillMoves?: number;
}

interface SoFIFATeam {
  id: number;
  name: string;
  players: SoFIFAPlayer[];
}

// UCL Team SoFIFA IDs (from existing sofifaApi.ts)
const UCL_TEAM_SOFIFA_IDS: Record<string, number> = {
  'Manchester City FC': 10,
  'Liverpool FC': 9,
  'Arsenal FC': 1,
  'Chelsea FC': 5,
  'Newcastle United FC': 13,
  'Tottenham Hotspur FC': 18,
  'Real Madrid CF': 243,
  'FC Barcelona': 241,
  'Club Atlético de Madrid': 240,
  'Athletic Club': 448,
  'Villarreal CF': 483,
  'FC Bayern München': 21,
  'Borussia Dortmund': 22,
  'Bayer 04 Leverkusen': 32,
  'Eintracht Frankfurt': 24,
  'FC Internazionale Milano': 44,
  'Juventus FC': 45,
  'SSC Napoli': 48,
  'Atalanta BC': 55,
  'Paris Saint-Germain FC': 73,
  'AS Monaco FC': 69,
  'Olympique de Marseille': 66,
  'PSV': 247,
  'AFC Ajax': 245,
  'Sport Lisboa e Benfica': 234,
  'Sporting Clube de Portugal': 237,
  'FC København': 1450,
  'Club Brugge KV': 246,
  'Galatasaray SK': 83,
};

// Rate limiting state
let requestCount = 0;
let requestResetTime = Date.now() + 60000;

async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  
  if (now >= requestResetTime) {
    requestCount = 0;
    requestResetTime = now + 60000;
  }

  if (requestCount >= 58) {
    const waitTime = requestResetTime - now;
    console.log(`  ⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
    requestCount = 0;
    requestResetTime = Date.now() + 60000;
  }

  requestCount++;
}

async function fetchTeamData(teamId: number): Promise<SoFIFATeam | null> {
  try {
    await checkRateLimit();
    
    const response = await axios.get(`${SOFIFA_API_BASE}/team/${teamId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://sofifa.com',
      },
      timeout: 15000,
    });

    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('  ⚠️  Rate limited. Waiting 60s...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchTeamData(teamId);
    }
    console.error(`  ❌ Error fetching team ${teamId}:`, error.message);
    return null;
  }
}

async function downloadPlayerImage(playerId: number, playerName: string): Promise<string | null> {
  try {
    // SoFIFA player image URL pattern
    const imageUrl = `https://cdn.sofifa.net/players/${String(playerId).padStart(3, '0').slice(0, 3)}/${playerId}.png`;
    
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
    // Fallback to default image
    return '/player-images/default-player.png';
  }
}

function mapPosition(positionCode: number): string {
  // Position mapping from SoFIFA position codes
  const posMap: Record<number, string> = {
    0: 'GK',
    3: 'DEF', 4: 'DEF', 5: 'DEF', 6: 'DEF', 7: 'DEF',
    10: 'MID', 14: 'MID', 18: 'MID',
    21: 'FWD', 23: 'FWD', 25: 'FWD', 27: 'FWD',
  };
  return posMap[positionCode] || 'MID';
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

async function syncTopPlayersForTeam(dbTeamName: string, sofifaTeamId: number): Promise<number> {
  console.log(`\n🏆 ${dbTeamName} (SoFIFA ID: ${sofifaTeamId})`);
  
  const teamData = await fetchTeamData(sofifaTeamId);
  
  if (!teamData || !teamData.players || teamData.players.length === 0) {
    console.log(`  ⏭️  Skipping - no players found`);
    return 0;
  }

  console.log(`  📊 Found ${teamData.players.length} players`);

  // Sort by overall rating and get top 10
  const topPlayers = teamData.players
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 10);

  console.log(`  🎯 Processing top ${topPlayers.length} players`);

  let updated = 0;
  let created = 0;

  for (const sofifaPlayer of topPlayers) {
    const fullName = sofifaPlayer.commonName || `${sofifaPlayer.firstName} ${sofifaPlayer.lastName}`;
    
    // Download player image
    const imagePath = await downloadPlayerImage(sofifaPlayer.id, fullName);

    // Check if player exists in database
    const existingPlayers = await db
      .select()
      .from(players)
      .where(
        sql`LOWER(${players.name}) = LOWER(${fullName}) AND LOWER(${players.team}) LIKE LOWER(${'%' + dbTeamName + '%'})`
      );

    const mappedPosition = mapPosition(sofifaPlayer.position1);

    const playerData = {
      name: fullName,
      team: dbTeamName,
      position: mappedPosition,
      imageUrl: imagePath || '/player-images/default-player.png',
      playerFaceUrl: imagePath,
      overall: sofifaPlayer.overallRating,
      potential: sofifaPlayer.potential,
      radarStats: {
        pace: sofifaPlayer.pac,
        shooting: sofifaPlayer.sho,
        passing: sofifaPlayer.pas,
        dribbling: sofifaPlayer.dri,
        defending: sofifaPlayer.def,
        physical: sofifaPlayer.phy
      },
      sofifaId: sofifaPlayer.id.toString(),
      preferredFoot: sofifaPlayer.preferredFoot || 'Right',
      weakFoot: sofifaPlayer.weakFoot?.toString() || '3',
      skillMoves: sofifaPlayer.skillMoves?.toString() || '3',
      expectedContribution: calculateBaseExpectation(mappedPosition, sofifaPlayer.overallRating),
      predictedMinutes: 85,
      statProbability: 0.35,
      statType: getStatTypeForPosition(mappedPosition),
      last5Avg: calculateBaseExpectation(mappedPosition, sofifaPlayer.overallRating),
      stat90: calculateBaseExpectation(mappedPosition, sofifaPlayer.overallRating) * 1.1,
    };

    if (existingPlayers.length > 0) {
      await db
        .update(players)
        .set(playerData)
        .where(eq(players.id, existingPlayers[0].id));
      
      console.log(`  ✏️  Updated: ${fullName} (${sofifaPlayer.overallRating} OVR)`);
      updated++;
    } else {
      await db.insert(players).values({
        id: `${dbTeamName.replace(/\s+/g, '_').toLowerCase()}_${sofifaPlayer.id}`,
        ...playerData
      });
      
      console.log(`  ➕ Created: ${fullName} (${sofifaPlayer.overallRating} OVR)`);
      created++;
    }

    // Small delay between players
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`  ✅ Synced ${created + updated} players (${created} new, ${updated} updated)`);
  return created + updated;
}

async function main() {
  console.log("\n⚽ SYNCING TOP 10 UCL PLAYERS PER TEAM");
  console.log("=".repeat(60));

  const teams = Object.entries(UCL_TEAM_SOFIFA_IDS);
  console.log(`📋 Teams to process: ${teams.length}`);
  console.log(`🎯 Target: Top 10 players per team\n`);

  let totalPlayers = 0;
  let successfulTeams = 0;

  for (const [dbTeamName, sofifaId] of teams) {
    const playersUpdated = await syncTopPlayersForTeam(dbTeamName, sofifaId);
    
    if (playersUpdated > 0) {
      totalPlayers += playersUpdated;
      successfulTeams++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Sync Complete!`);
  console.log(`   Teams processed: ${successfulTeams}/${teams.length}`);
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
