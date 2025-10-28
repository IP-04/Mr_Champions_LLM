/**
 * FIFA-style Player Stats Generator
 * Generates realistic radar stats based on position and overall rating
 * This replaces SoFIFA scraping which gets blocked by anti-bot protection
 */

import { db } from '../../db/index.js';
import { players } from '../../shared/schema.js';
import { eq, isNull, or } from 'drizzle-orm';

interface RadarStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

// Position-based stat multipliers (more realistic FIFA-style)
const POSITION_PROFILES: Record<string, RadarStats> = {
  // Forwards
  'Centre-Forward': { pace: 0.85, shooting: 0.95, passing: 0.70, dribbling: 0.80, defending: 0.35, physical: 0.75 },
  'Left Winger': { pace: 0.92, shooting: 0.80, passing: 0.75, dribbling: 0.90, defending: 0.40, physical: 0.65 },
  'Right Winger': { pace: 0.92, shooting: 0.80, passing: 0.75, dribbling: 0.90, defending: 0.40, physical: 0.65 },
  'Attacking Midfield': { pace: 0.80, shooting: 0.82, passing: 0.88, dribbling: 0.88, defending: 0.50, physical: 0.68 },
  
  // Midfielders
  'Central Midfield': { pace: 0.72, shooting: 0.70, passing: 0.88, dribbling: 0.78, defending: 0.72, physical: 0.75 },
  'Defensive Midfield': { pace: 0.68, shooting: 0.60, passing: 0.80, dribbling: 0.70, defending: 0.85, physical: 0.82 },
  'Left Midfield': { pace: 0.85, shooting: 0.72, passing: 0.82, dribbling: 0.85, defending: 0.60, physical: 0.70 },
  'Right Midfield': { pace: 0.85, shooting: 0.72, passing: 0.82, dribbling: 0.85, defending: 0.60, physical: 0.70 },
  
  // Defenders
  'Centre-Back': { pace: 0.62, shooting: 0.45, passing: 0.65, dribbling: 0.55, defending: 0.92, physical: 0.88 },
  'Left-Back': { pace: 0.82, shooting: 0.55, passing: 0.75, dribbling: 0.72, defending: 0.80, physical: 0.78 },
  'Right-Back': { pace: 0.82, shooting: 0.55, passing: 0.75, dribbling: 0.72, defending: 0.80, physical: 0.78 },
  
  // Goalkeepers (special case - uses different stats internally)
  'Goalkeeper': { pace: 0.50, shooting: 0.40, passing: 0.60, dribbling: 0.45, defending: 0.55, physical: 0.70 },
};

// Default for unknown positions
const DEFAULT_PROFILE: RadarStats = {
  pace: 0.75,
  shooting: 0.70,
  passing: 0.75,
  dribbling: 0.75,
  defending: 0.65,
  physical: 0.72,
};

export class PlayerStatsGenerator {
  /**
   * Generate realistic FIFA-style radar stats for a player
   */
  private generateRadarStats(position: string, overall: number): RadarStats {
    // Get position profile or default
    const profile = POSITION_PROFILES[position] || DEFAULT_PROFILE;
    
    // Convert overall (40-99 scale) to base stat value
    const baseValue = overall;
    
    // Add slight randomness for realism (±3 points)
    const randomize = (value: number) => {
      const variance = Math.floor(Math.random() * 7) - 3; // -3 to +3
      return Math.max(40, Math.min(99, value + variance));
    };
    
    // Calculate each stat based on position profile
    return {
      pace: randomize(Math.round(baseValue * profile.pace)),
      shooting: randomize(Math.round(baseValue * profile.shooting)),
      passing: randomize(Math.round(baseValue * profile.passing)),
      dribbling: randomize(Math.round(baseValue * profile.dribbling)),
      defending: randomize(Math.round(baseValue * profile.defending)),
      physical: randomize(Math.round(baseValue * profile.physical)),
    };
  }

  /**
   * Update a single player with generated stats
   */
  async updatePlayerStats(playerId: string): Promise<boolean> {
    try {
      // Get player from database
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (!player) {
        console.log(`❌ Player ${playerId} not found`);
        return false;
      }

      // Skip if already has radar stats
      if (player.radarStats) {
        console.log(`⏭️  Player ${player.name} already has stats`);
        return true;
      }

      // Generate stats
      const radarStats = this.generateRadarStats(
        player.position,
        Math.round(player.overall * 10) // Convert 0-10 to 40-99 scale
      );

      // Update player
      await db
        .update(players)
        .set({ radarStats })
        .where(eq(players.id, playerId));

      console.log(`✅ Generated stats for ${player.name}: Pace ${radarStats.pace}, Shooting ${radarStats.shooting}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Batch update all players without radar stats
   */
  async generateStatsForAllPlayers(): Promise<{ success: number; failed: number }> {
    console.log('🔄 Generating FIFA-style stats for players...');
    
    try {
      // Get all players without radar stats
      const playersToUpdate = await db
        .select()
        .from(players)
        .where(or(
          isNull(players.radarStats),
          eq(players.radarStats, {})
        ));

      console.log(`Found ${playersToUpdate.length} players needing stats`);

      let success = 0;
      let failed = 0;

      // Update each player
      for (const player of playersToUpdate) {
        try {
          // Generate stats
          const overall = Math.round(player.overall * 10); // Convert 0-10 to 0-100 scale
          const radarStats = this.generateRadarStats(player.position, overall);

          // Update in database
          await db
            .update(players)
            .set({ radarStats })
            .where(eq(players.id, player.id));

          success++;
          
          if (success % 50 === 0) {
            console.log(`✅ Processed ${success} players...`);
          }
        } catch (error) {
          console.error(`❌ Failed to update ${player.name}:`, error);
          failed++;
        }
      }

      console.log(`\n=== STATS GENERATION COMPLETE ===`);
      console.log(`✅ Successfully updated: ${success} players`);
      console.log(`❌ Failed: ${failed} players`);

      return { success, failed };
    } catch (error) {
      console.error('❌ Error in batch stats generation:', error);
      return { success: 0, failed: 0 };
    }
  }
}

export const playerStatsGenerator = new PlayerStatsGenerator();
