/**
 * Comprehensive Player Data Sync Script
 * Syncs player radar stats and images from SoFIFA using Playwright scraper
 * 
 * Usage:
 * npm run sync-players -- --limit 50
 * npm run sync-players -- --team "PSG"
 * npm run sync-players -- --missing-only
 */

import { db } from "../db/index.js";
import { players } from "../shared/schema.js";
import { eq, isNull, or, sql } from "drizzle-orm";
import { sofifaScraper } from "../server/services/sofifaPlaywrightScraper.js";

interface SyncOptions {
  limit?: number;
  team?: string;
  missingOnly?: boolean;
}

/**
 * Calculate FIFA 6 main attributes from detailed stats
 */
function calculateRadarStats(playerData: any) {
  return {
    pace: playerData.fifa_pace || Math.round(((playerData.movement_acceleration || 0) + (playerData.movement_sprint_speed || 0)) / 2),
    shooting: playerData.fifa_shooting || Math.round(((playerData.attacking_finishing || 0) + (playerData.power_shot_power || 0)) / 2),
    passing: playerData.fifa_passing || Math.round(((playerData.attacking_short_passing || 0) + (playerData.skill_long_passing || 0)) / 2),
    dribbling: playerData.fifa_dribbling || Math.round(((playerData.skill_dribbling || 0) + (playerData.skill_ball_control || 0)) / 2),
    defending: playerData.fifa_defending || Math.round(((playerData.defending_defensive_awareness || 0) + (playerData.defending_standing_tackle || 0)) / 2),
    physical: playerData.fifa_physical || Math.round(((playerData.power_strength || 0) + (playerData.power_stamina || 0)) / 2),
  };
}

async function syncPlayerData(options: SyncOptions = {}) {
  console.log('\n🔄 Starting Player Data Sync (Playwright Scraper)...');
  console.log('Options:', options);
  
  try {
    // Get players to sync
    let query = db.select().from(players);
    
    if (options.missingOnly) {
      // Only sync players without radar stats or with ZERO radar stats or images BUT WITH sofifaUrl
      query = query.where(
        sql`(
          ${players.radarStats} IS NULL 
          OR ${players.playerFaceUrl} IS NULL
          OR (${players.radarStats}->>'pace')::int = 0
        ) AND ${players.sofifaUrl} IS NOT NULL`
      ) as any;
    }
    
    if (options.team) {
      query = query.where(eq(players.team, options.team)) as any;
    }
    
    const playersToSync = await query;
    
    const limitedPlayers = options.limit 
      ? playersToSync.slice(0, options.limit)
      : playersToSync;
    
    console.log(`\n📊 Found ${playersToSync.length} total players`);
    console.log(`📋 Syncing ${limitedPlayers.length} players...\n`);
    
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < limitedPlayers.length; i++) {
      const player = limitedPlayers[i];
      
      console.log(`\n[${i + 1}/${limitedPlayers.length}] 👤 ${player.name} (${player.team}) - ${player.position}`);
      
      // Check if player already has data
      if (!options.missingOnly && player.radarStats && player.playerFaceUrl) {
        console.log('  ✓ Already has complete data (skipping)');
        skippedCount++;
        continue;
      }
      
      // Check if player has sofifaUrl
      if (!player.sofifaUrl) {
        console.log('  ⚠️  No SoFIFA URL found - needs manual assignment');
        failCount++;
        continue;
      }
      
      try {
        console.log(`  🔗 ${player.sofifaUrl}`);
        
        // Scrape player data using Playwright
        const playerData = await sofifaScraper.scrapePlayer(player.sofifaUrl);
        
        if (!playerData) {
          console.log('  ❌ Failed to scrape data');
          failCount++;
          continue;
        }
        
        // Calculate radar stats from detailed attributes
        const radarStats = calculateRadarStats(playerData);
        
        // Update player in database
        await db.update(players)
          .set({
            playerFaceUrl: playerData.player_face_url,
            overall: playerData.overall,
            potential: playerData.potential,
            radarStats: radarStats,
            preferredFoot: playerData.preferred_foot,
            weakFoot: playerData.weak_foot,
            skillMoves: playerData.skill_moves,
            workRate: playerData.work_rate,
            lastScraped: new Date(),
          })
          .where(eq(players.id, player.id));
        
        console.log(`  ✅ Overall: ${playerData.overall} | Face: ${playerData.player_face_url ? '✓' : '✗'}`);
        console.log(`  📈 FIFA Stats - PAC:${radarStats.pace} SHO:${radarStats.shooting} PAS:${radarStats.passing} DRI:${radarStats.dribbling} DEF:${radarStats.defending} PHY:${radarStats.physical}`);
        
        successCount++;
        
        // Rate limiting: 3-5 seconds between requests
        if (i < limitedPlayers.length - 1) {
          const delay = 3000 + Math.random() * 2000;
          console.log(`  ⏳ Waiting ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.log(`  ❌ Failed:`, error instanceof Error ? error.message : 'Unknown error');
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    if (successCount + failCount > 0) {
      console.log(`📈 Success Rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Sync failed with error:', error);
    throw error;
  }
}

// Parse command line arguments
function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--team' && args[i + 1]) {
      options.team = args[i + 1];
      i++;
    } else if (arg === '--missing-only') {
      options.missingOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Player Data Sync Script
======================

Usage: npm run sync-players -- [options]

Options:
  --limit <number>     Limit number of players to sync
  --team <name>        Only sync players from specific team
  --missing-only       Only sync players missing radarStats or images
  --help, -h          Show this help message

Examples:
  npm run sync-players -- --limit 50
  npm run sync-players -- --team "PSG"
  npm run sync-players -- --missing-only --limit 100
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// Stats summary
async function showStatsSummary() {
  console.log('\n📊 Current Player Data Status:');
  console.log('='.repeat(60));
  
  const allPlayers = await db.select().from(players);
  const withRadarStats = allPlayers.filter(p => p.radarStats);
  const withImages = allPlayers.filter(p => p.playerFaceUrl);
  const withBoth = allPlayers.filter(p => p.radarStats && p.playerFaceUrl);
  const withSofifaUrl = allPlayers.filter(p => p.sofifaUrl);
  
  console.log(`Total Players: ${allPlayers.length}`);
  console.log(`With Radar Stats: ${withRadarStats.length} (${((withRadarStats.length / allPlayers.length) * 100).toFixed(1)}%)`);
  console.log(`With Face Images: ${withImages.length} (${((withImages.length / allPlayers.length) * 100).toFixed(1)}%)`);
  console.log(`With Both: ${withBoth.length} (${((withBoth.length / allPlayers.length) * 100).toFixed(1)}%)`);
  console.log(`With SoFIFA URL: ${withSofifaUrl.length} (${((withSofifaUrl.length / allPlayers.length) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60) + '\n');
}

// Main execution
async function main() {
  const options = parseArgs();
  
  try {
    await showStatsSummary();
    
    if (options.limit === undefined && !options.missingOnly && !options.team) {
      console.log('⚠️  No limit specified. This will sync ALL players.');
      console.log('💡 Consider using --limit or --missing-only flags.');
      console.log('   Use --help for more information.\n');
    }
    
    await syncPlayerData(options);
    await showStatsSummary();
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    // Always close the browser
    await sofifaScraper.close();
    console.log('🏁 Browser closed');
    process.exit(0);
  }
}

main();

