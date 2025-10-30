import { db } from "../db";
import { players } from "@shared/schema";
import { eq, sql, like } from "drizzle-orm";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PlayerUrlMapping {
  url: string;
  playerName: string;
  playerId: string;
}

function extractPlayerNameFromUrl(url: string): string {
  // URL format: https://sofifa.com/player/231747/kylian-mbappe/260006/
  const match = url.match(/\/player\/\d+\/([^/]+)\//);
  if (!match) return '';
  
  // Convert kebab-case to Title Case and handle special characters
  const name = match[1]
    .split('-')
    .map(word => {
      // Handle special cases
      if (word === 'de' || word === 'da' || word === 'dos' || word === 'van' || word === 'del') {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  return name;
}

function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íì]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úù]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function importPlayerUrls() {
  console.log('📥 Importing SoFIFA URLs from CSV\n');
  
  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, '..', 'sofifa-web-scraper', 'player_urls.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV (skip header)
    const lines = csvContent.split('\n').slice(1).filter(line => line.trim());
    const playerUrls = lines.map(line => line.trim());
    
    console.log(`📋 Found ${playerUrls.length} player URLs in CSV\n`);
    
    // Get all players from database
    const allPlayers = await db.select().from(players);
    console.log(`🗄️  Found ${allPlayers.length} players in database\n`);
    
    // Group players by team for better organization
    const playersByTeam = allPlayers.reduce((acc, player) => {
      if (!acc[player.team]) {
        acc[player.team] = [];
      }
      acc[player.team].push(player);
      return acc;
    }, {} as Record<string, typeof allPlayers>);
    
    let totalMatched = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const unmatchedUrls: string[] = [];
    
    // Process each URL
    for (const url of playerUrls) {
      if (!url.startsWith('http')) continue;
      
      // Extract player name from URL
      const urlPlayerName = extractPlayerNameFromUrl(url);
      const normalizedUrlName = normalizePlayerName(urlPlayerName);
      
      // Try to find matching player in database
      let matchedPlayer = null;
      
      // Strategy 1: Exact match (normalized)
      for (const player of allPlayers) {
        const normalizedDbName = normalizePlayerName(player.name);
        if (normalizedDbName === normalizedUrlName) {
          matchedPlayer = player;
          break;
        }
      }
      
      // Strategy 2: Last name match (for players with different first name formats)
      if (!matchedPlayer) {
        const urlLastName = normalizedUrlName.split(' ').pop() || '';
        if (urlLastName.length > 3) {
          for (const player of allPlayers) {
            const dbLastName = normalizePlayerName(player.name).split(' ').pop() || '';
            if (urlLastName === dbLastName) {
              matchedPlayer = player;
              break;
            }
          }
        }
      }
      
      // Strategy 3: Contains match (one name contains the other)
      if (!matchedPlayer) {
        for (const player of allPlayers) {
          const normalizedDbName = normalizePlayerName(player.name);
          if (normalizedDbName.includes(normalizedUrlName) || normalizedUrlName.includes(normalizedDbName)) {
            matchedPlayer = player;
            break;
          }
        }
      }
      
      if (matchedPlayer) {
        totalMatched++;
        
        // Skip if already has URL
        if (matchedPlayer.sofifaUrl) {
          console.log(`  ⏭️  ${matchedPlayer.name} - Already has URL`);
          totalSkipped++;
          continue;
        }
        
        // Update player with URL
        await db.update(players)
          .set({ sofifaUrl: url })
          .where(eq(players.id, matchedPlayer.id));
        
        console.log(`  ✅ ${matchedPlayer.name} (${matchedPlayer.team}) → ${url}`);
        totalUpdated++;
      } else {
        unmatchedUrls.push(`${urlPlayerName} → ${url}`);
      }
    }
    
    console.log('\n\n📈 Summary:');
    console.log(`  ✅ Matched players: ${totalMatched}`);
    console.log(`  💾 URLs updated: ${totalUpdated}`);
    console.log(`  ⏭️  Skipped (already had URL): ${totalSkipped}`);
    console.log(`  ❌ Unmatched URLs: ${unmatchedUrls.length}`);
    
    if (unmatchedUrls.length > 0 && unmatchedUrls.length < 20) {
      console.log('\n⚠️  Unmatched players:');
      unmatchedUrls.slice(0, 20).forEach(url => {
        console.log(`    - ${url}`);
      });
    }
    
    console.log(`\n✨ Done! ${totalUpdated} players can now be synced with real SoFIFA data.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
importPlayerUrls();
