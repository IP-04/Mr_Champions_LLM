import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function findDuplicatePlayers() {
  console.log('\n🔍 Searching for duplicate players...\n');
  
  // Find potential duplicates by similar names
  const allPlayers = await db.select().from(players);
  
  // Group by normalized name (ignoring dots, spaces, case)
  const nameMap = new Map<string, typeof allPlayers>();
  
  for (const player of allPlayers) {
    // Normalize: remove dots, extra spaces, lowercase
    // Also extract last name for better matching
    const normalized = player.name
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract last name (last word after splitting)
    const parts = normalized.split(' ');
    const lastName = parts[parts.length - 1];
    
    // Use last name + team as key to catch abbreviated vs full name duplicates
    const key = `${lastName}|${player.team}`;
    
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(player);
  }
  
  // Find groups with duplicates
  const duplicates: Array<{ normalizedName: string; players: typeof allPlayers }> = [];
  
  for (const [normalizedName, playerGroup] of nameMap.entries()) {
    if (playerGroup.length > 1) {
      duplicates.push({ normalizedName, players: playerGroup });
    }
  }
  
  console.log(`Found ${duplicates.length} groups of duplicate players:\n`);
  
  for (const group of duplicates) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`👥 "${group.normalizedName.toUpperCase()}" - ${group.players.length} records`);
    console.log('='.repeat(80));
    
    group.players.forEach((player, idx) => {
      console.log(`\n[${idx + 1}] ${player.name} (ID: ${player.id})`);
      console.log(`    Team: ${player.team}`);
      console.log(`    Position: ${player.position}`);
      console.log(`    Overall: ${player.overall || 'NULL'}`);
      console.log(`    Expected: ${player.expectedContribution}`);
      console.log(`    Minutes: ${player.predictedMinutes}`);
      console.log(`    Probability: ${player.statProbability}`);
      console.log(`    Last5Avg: ${player.last5Avg}`);
      console.log(`    Stat90: ${player.stat90}`);
      console.log(`    PlayerFaceUrl: ${player.playerFaceUrl || 'NULL'}`);
      console.log(`    ImageUrl: ${player.imageUrl || 'NULL'}`);
      console.log(`    RadarStats: ${player.radarStats ? JSON.stringify(player.radarStats) : 'NULL'}`);
      console.log(`    SofifaId: ${player.sofifaId || 'NULL'}`);
      console.log(`    SofifaUrl: ${player.sofifaUrl || 'NULL'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total players: ${allPlayers.length}`);
  console.log(`   Duplicate groups: ${duplicates.length}`);
  console.log(`   Total duplicate records: ${duplicates.reduce((sum, g) => sum + g.players.length, 0)}`);
  console.log('='.repeat(80) + '\n');
  
  return duplicates;
}

findDuplicatePlayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

