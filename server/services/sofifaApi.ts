/**
 * SoFIFA API Integration
 * Official API for getting FIFA player data
 * Rate limit: 60 requests/minute
 */

import axios from 'axios';
import { db } from '../../db/index.js';
import { players } from '../../shared/schema.js';
import { eq, isNull, or, sql } from 'drizzle-orm';

const SOFIFA_API_BASE = 'https://api.sofifa.net';
const SOFIFA_API_TOKEN = process.env.SOFIFA_API_TOKEN || '';
const LATEST_ROSTER = '250003'; // FIFA 25, latest roster

interface SofifaPlayer {
  id: number;
  firstName: string;
  lastName: string;
  commonName: string;
  overallRating: number;
  pac: number; // Pace
  sho: number; // Shooting
  pas: number; // Passing
  dri: number; // Dribbling
  def: number; // Defending
  phy: number; // Physical
  position1: number;
  teams: Array<{
    id: number;
    name: string;
  }>;
}

interface SofifaTeam {
  id: number;
  name: string;
  players: SofifaPlayer[];
}

// Position mapping from SoFIFA position codes to readable names
const POSITION_MAP: Record<number, string> = {
  0: 'Goalkeeper',
  3: 'Right-Back',
  4: 'Centre-Back',
  5: 'Centre-Back',
  6: 'Centre-Back',
  7: 'Left-Back',
  10: 'Defensive Midfield',
  14: 'Central Midfield',
  18: 'Attacking Midfield',
  21: 'Centre-Forward',
  23: 'Right Winger',
  25: 'Centre-Forward',
  27: 'Left Winger',
};

// Team name mapping (SoFIFA names might differ from Football-Data.org)
const TEAM_NAME_MAP: Record<string, string> = {
  'Man City': 'Manchester City FC',
  'Manchester City': 'Manchester City FC',
  'Liverpool': 'Liverpool FC',
  'Arsenal': 'Arsenal FC',
  'Chelsea': 'Chelsea FC',
  'Real Madrid': 'Real Madrid CF',
  'FC Barcelona': 'FC Barcelona',
  'Barcelona': 'FC Barcelona',
  'Bayern Munich': 'FC Bayern München',
  'Bayern München': 'FC Bayern München',
  'PSG': 'Paris Saint-Germain FC',
  'Paris SG': 'Paris Saint-Germain FC',
  'Inter': 'FC Internazionale Milano',
  'Inter Milan': 'FC Internazionale Milano',
  'Atlético Madrid': 'Club Atlético de Madrid',
  'Atletico Madrid': 'Club Atlético de Madrid',
  'Dortmund': 'Borussia Dortmund',
  'Borussia Dortmund': 'Borussia Dortmund',
};

export class SofifaApiService {
  private requestCount = 0;
  private requestResetTime = Date.now() + 60000;

  /**
   * Rate limiting - max 60 requests per minute
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now >= this.requestResetTime) {
      this.requestCount = 0;
      this.requestResetTime = now + 60000;
    }

    // Wait if we've hit the limit
    if (this.requestCount >= 58) { // Stay under 60 to be safe
      const waitTime = this.requestResetTime - now;
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
      this.requestCount = 0;
      this.requestResetTime = Date.now() + 60000;
    }

    this.requestCount++;
  }

  /**
   * Normalize team name for matching
   */
  private normalizeTeamName(name: string): string {
    return TEAM_NAME_MAP[name] || name;
  }

  /**
   * Get team data from SoFIFA including all players
   */
  async getTeamData(teamId: number): Promise<SofifaTeam | null> {
    try {
      await this.checkRateLimit();
      
      console.log(`📡 Fetching team ${teamId} from SoFIFA API...`);
      
      const response = await axios.get(`${SOFIFA_API_BASE}/team/${teamId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://sofifa.com',
        },
        timeout: 15000,
      });

      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log('⚠️  Rate limited by SoFIFA. Waiting 60s...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.getTeamData(teamId); // Retry
      }
      console.error(`❌ Error fetching team ${teamId}:`, error.message);
      return null;
    }
  }

  /**
   * Get player data from SoFIFA
   */
  async getPlayerData(playerId: number): Promise<SofifaPlayer | null> {
    try {
      await this.checkRateLimit();
      
      console.log(`📡 Fetching player ${playerId} from SoFIFA API...`);
      
      const response = await axios.get(`${SOFIFA_API_BASE}/player/${playerId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://sofifa.com',
        },
        timeout: 15000,
      });

      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log('⚠️  Rate limited by SoFIFA. Waiting 60s...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        return this.getPlayerData(playerId); // Retry
      }
      console.error(`❌ Error fetching player ${playerId}:`, error.message);
      return null;
    }
  }

  /**
   * Update player in database with SoFIFA data
   */
  async updatePlayerWithSofifaData(dbPlayerId: string, playerName: string, teamName: string): Promise<boolean> {
    try {
      // For now, we'll use the generator since we need to map players by name
      // The SoFIFA API requires team IDs which we don't have mapped yet
      console.log(`⏭️  Skipping SoFIFA lookup for ${playerName} (requires team ID mapping)`);
      return false;
    } catch (error) {
      console.error(`❌ Error updating player ${playerName}:`, error);
      return false;
    }
  }

  /**
   * Sync all players from a specific SoFIFA team
   */
  async syncTeamPlayers(sofifaTeamId: number, dbTeamName: string): Promise<number> {
    try {
      console.log(`\n🔄 Syncing team: ${dbTeamName} (SoFIFA ID: ${sofifaTeamId})`);
      
      const teamData = await this.getTeamData(sofifaTeamId);
      if (!teamData || !teamData.players) {
        console.log(`❌ No data found for team ${sofifaTeamId}`);
        return 0;
      }

      console.log(`Found ${teamData.players.length} players in ${teamData.name}`);
      
      let updated = 0;

      for (const sofifaPlayer of teamData.players) {
        try {
          const fullName = sofifaPlayer.commonName || `${sofifaPlayer.firstName} ${sofifaPlayer.lastName}`;
          
          // Find matching player in our database by name and team
          const [dbPlayer] = await db
            .select()
            .from(players)
            .where(
              sql`LOWER(${players.name}) = LOWER(${fullName}) AND LOWER(${players.team}) = LOWER(${dbTeamName})`
            )
            .limit(1);

          if (!dbPlayer) {
            // Try matching by last name only
            const [dbPlayerByLastName] = await db
              .select()
              .from(players)
              .where(
                sql`LOWER(${players.name}) LIKE LOWER(${'%' + sofifaPlayer.lastName + '%'}) AND LOWER(${players.team}) = LOWER(${dbTeamName})`
              )
              .limit(1);

            if (!dbPlayerByLastName) {
              console.log(`⏭️  Player not found in DB: ${fullName}`);
              continue;
            }
          }

          const playerToUpdate = dbPlayer;

          // Update with SoFIFA data
          const radarStats = {
            pace: sofifaPlayer.pac,
            shooting: sofifaPlayer.sho,
            passing: sofifaPlayer.pas,
            dribbling: sofifaPlayer.dri,
            defending: sofifaPlayer.def,
            physical: sofifaPlayer.phy,
          };

          await db
            .update(players)
            .set({
              radarStats,
              sofifaId: sofifaPlayer.id.toString(),
              overall: sofifaPlayer.overallRating / 10, // Convert 0-99 to 0-9.9
            })
            .where(eq(players.id, playerToUpdate.id));

          updated++;
          console.log(`✅ Updated ${fullName}: PAC ${sofifaPlayer.pac}, SHO ${sofifaPlayer.sho}`);

        } catch (error) {
          console.error(`❌ Error processing player:`, error);
        }
      }

      console.log(`✅ Updated ${updated}/${teamData.players.length} players for ${teamData.name}`);
      return updated;

    } catch (error) {
      console.error(`❌ Error syncing team ${sofifaTeamId}:`, error);
      return 0;
    }
  }
}

export const sofifaApi = new SofifaApiService();

/**
 * Champions League team mapping (Football-Data.org team name -> SoFIFA team ID)
 * These IDs are from the official FIFA game release
 */
export const UCL_TEAM_SOFIFA_IDS: Record<string, number> = {
  // English Teams
  'Manchester City FC': 10,
  'Liverpool FC': 9,
  'Arsenal FC': 1,
  'Chelsea FC': 5,
  'Newcastle United FC': 13,
  'Tottenham Hotspur FC': 18,
  
  // Spanish Teams
  'Real Madrid CF': 243,
  'FC Barcelona': 241,
  'Club Atlético de Madrid': 240,
  'Athletic Club': 448,
  'Villarreal CF': 483,
  
  // German Teams
  'FC Bayern München': 21,
  'Borussia Dortmund': 22,
  'Bayer 04 Leverkusen': 32,
  'Eintracht Frankfurt': 24,
  
  // Italian Teams
  'FC Internazionale Milano': 44,
  'Juventus FC': 45,
  'SSC Napoli': 48,
  'Atalanta BC': 55,
  
  // French Teams
  'Paris Saint-Germain FC': 73,
  'AS Monaco FC': 69,
  'Olympique de Marseille': 66,
  
  // Other Teams
  'PSV': 247,
  'AFC Ajax': 245,
  'Sport Lisboa e Benfica': 234,
  'Sporting Clube de Portugal': 237,
  'FC København': 1450,
  'Club Brugge KV': 246,
  'Galatasaray SK': 83,
  'Royale Union Saint-Gilloise': 1931,
  'SK Slavia Praha': 598,
  'Qarabağ Ağdam FK': 111558,
  'FK Bodø/Glimt': 111660,
  'PAE Olympiakos SFP': 85,
  'Paphos FC': 111795,
  'FK Kairat': 111077,
};
