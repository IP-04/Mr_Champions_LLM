import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../../db/index.js';
import { players } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

interface PlayerStats {
  name: string;
  overall: number;
  position: string;
  imageUrl: string;
  team: string;
  sofifaId: string;
  // Radar chart stats
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export class PlayerDataScraper {
  private readonly BASE_URL = 'https://sofifa.com';
  private readonly HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/',
  };
  
  /**
   * Search for a player and get their detailed stats
   */
  async searchPlayer(playerName: string, teamName: string): Promise<PlayerStats | null> {
    try {
      console.log(`🔍 Searching for player: ${playerName} (${teamName})`);
      
      // Search for player
      const searchUrl = `${this.BASE_URL}/players?keyword=${encodeURIComponent(playerName)}`;
      const searchResponse = await axios.get(searchUrl, {
        headers: this.HEADERS,
        timeout: 10000,
      });
      
      const $ = cheerio.load(searchResponse.data);
      let playerHref: string | null = null;
      let foundTeam = '';
      
      // Find player in search results matching team
      $('tbody tr').each((_, row) => {
        const nameElement = $(row).find('td[data-col="ae"] a').first();
        const name = nameElement.text().trim();
        const teamElement = $(row).find('td[data-col="tm"] a[href*="/team/"]').first();
        const team = teamElement.text().trim();
        
        if (name.toLowerCase().includes(playerName.toLowerCase()) && 
            team.toLowerCase().includes(teamName.toLowerCase())) {
          playerHref = nameElement.attr('href') || null;
          foundTeam = team;
          return false; // break
        }
      });
      
      if (!playerHref) {
        console.log(`❌ Player not found: ${playerName} (${teamName})`);
        return null;
      }
      
      const sofifaId = playerHref.split('/')[2];
      
      // Get player details
      const playerUrl = `${this.BASE_URL}${playerHref}`;
      console.log(`📊 Fetching player details from: ${playerUrl}`);
      
      const playerResponse = await axios.get(playerUrl, {
        headers: this.HEADERS,
        timeout: 10000,
      });
      
      const $player = cheerio.load(playerResponse.data);
      
      // Extract overall rating
      const overallElement = $player('div.bp3-card section.bp3-card div.bp3-card em').first();
      const overall = parseInt(overallElement.text().trim()) || 75;
      
      // Extract position
      const positionElement = $player('div.bp3-card section.bp3-card div.bp3-card span.pos').first();
      const position = positionElement.text().trim() || 'MID';
      
      // Extract player image
      const imageElement = $player('img[data-type="player"]');
      const imageUrl = imageElement.attr('data-src') || imageElement.attr('src') || '';
      
      // Extract name
      const nameElement = $player('div.bp3-card h1').first();
      const name = nameElement.text().trim() || playerName;
      
      // Extract stats with multiple fallback strategies
      const stats: PlayerStats = {
        name,
        overall,
        position,
        imageUrl,
        team: foundTeam || teamName,
        sofifaId,
        pace: this.extractStat($player, 'Pace') || this.estimateStat(overall, 'pace', position),
        shooting: this.extractStat($player, 'Shooting') || this.estimateStat(overall, 'shooting', position),
        passing: this.extractStat($player, 'Passing') || this.estimateStat(overall, 'passing', position),
        dribbling: this.extractStat($player, 'Dribbling') || this.estimateStat(overall, 'dribbling', position),
        defending: this.extractStat($player, 'Defending') || this.estimateStat(overall, 'defending', position),
        physical: this.extractStat($player, 'Physical') || this.estimateStat(overall, 'physical', position)
      };
      
      console.log(`✅ Found player: ${stats.name} - Overall: ${stats.overall} - Position: ${stats.position}`);
      console.log(`   Stats: PAC ${stats.pace}, SHO ${stats.shooting}, PAS ${stats.passing}, DRI ${stats.dribbling}, DEF ${stats.defending}, PHY ${stats.physical}`);
      
      return stats;
      
    } catch (error) {
      console.error(`❌ Error scraping player ${playerName}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
  
  /**
   * Extract specific stat from player page
   */
  private extractStat($: cheerio.CheerioAPI, statName: string): number | null {
    try {
      // Try multiple selector strategies
      const selectors = [
        `li:contains("${statName}") span.bp3-tag`,
        `li:has(span:contains("${statName}")) span.bp3-tag`,
        `div:contains("${statName}") em`,
      ];
      
      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          const value = parseInt(element.text().trim());
          if (!isNaN(value) && value >= 0 && value <= 99) {
            return value;
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Estimate stats based on overall rating and position
   */
  private estimateStat(overall: number, statType: string, position: string): number {
    const positionMultipliers: Record<string, Record<string, number>> = {
      'ST': { pace: 1.1, shooting: 1.3, passing: 0.8, dribbling: 1.1, defending: 0.4, physical: 1.0 },
      'CF': { pace: 1.1, shooting: 1.3, passing: 0.8, dribbling: 1.1, defending: 0.4, physical: 1.0 },
      'LW': { pace: 1.3, shooting: 1.1, passing: 0.9, dribbling: 1.2, defending: 0.5, physical: 0.8 },
      'RW': { pace: 1.3, shooting: 1.1, passing: 0.9, dribbling: 1.2, defending: 0.5, physical: 0.8 },
      'CAM': { pace: 0.9, shooting: 1.1, passing: 1.3, dribbling: 1.2, defending: 0.6, physical: 0.8 },
      'CM': { pace: 0.9, shooting: 0.8, passing: 1.2, dribbling: 1.0, defending: 1.0, physical: 1.0 },
      'CDM': { pace: 0.8, shooting: 0.6, passing: 1.1, dribbling: 0.9, defending: 1.3, physical: 1.1 },
      'LB': { pace: 1.1, shooting: 0.5, passing: 1.0, dribbling: 0.9, defending: 1.3, physical: 1.1 },
      'RB': { pace: 1.1, shooting: 0.5, passing: 1.0, dribbling: 0.9, defending: 1.3, physical: 1.1 },
      'CB': { pace: 0.7, shooting: 0.4, passing: 0.8, dribbling: 0.6, defending: 1.4, physical: 1.3 },
      'GK': { pace: 0.5, shooting: 0.3, passing: 0.7, dribbling: 0.5, defending: 1.2, physical: 1.0 },
    };
    
    const multiplier = positionMultipliers[position]?.[statType] || 1.0;
    const baseStat = overall * 0.85; // Use 85% of overall as base
    const estimatedStat = Math.round(baseStat * multiplier);
    
    // Clamp between 40 and 99
    return Math.min(99, Math.max(40, estimatedStat));
  }
  
  /**
   * Update individual player data in database
   */
  async updatePlayerData(playerId: string, playerName: string, teamName: string): Promise<boolean> {
    try {
      const stats = await this.searchPlayer(playerName, teamName);
      
      if (stats) {
        await db.update(players)
          .set({
            imageUrl: stats.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(stats.name)}&size=200&background=random`,
            sofifaId: stats.sofifaId,
            expectedContribution: stats.overall,
            radarStats: {
              pace: stats.pace,
              shooting: stats.shooting,
              passing: stats.passing,
              dribbling: stats.dribbling,
              defending: stats.defending,
              physical: stats.physical,
            }
          })
          .where(eq(players.id, playerId));
        
        console.log(`✅ Updated player in DB: ${playerName}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error updating player ${playerName}:`, error);
      return false;
    }
  }
  
  /**
   * Batch update players with rate limiting
   */
  async batchUpdatePlayers(playerList: Array<{ id: string; name: string; team: string }>): Promise<void> {
    console.log(`🔄 Starting batch update for ${playerList.length} players...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const player of playerList) {
      const success = await this.updatePlayerData(player.id, player.name, player.team);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limit: wait 2-3 seconds between requests
      const delay = 2000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log(`✅ Batch update complete: ${successCount} succeeded, ${failCount} failed`);
  }
}

export const playerDataScraper = new PlayerDataScraper();
