import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function checkWirtz() {
  console.log('\n🔍 Searching for Wirtz players...\n');
  
  const wirtzPlayers = await db.select().from(players).where(
    sql`LOWER(${players.name}) LIKE '%wirtz%'`
  );
  
  console.log(`Found ${wirtzPlayers.length} player(s) with "Wirtz" in name:\n`);
  
  wirtzPlayers.forEach((player, idx) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${idx + 1}] Player Details:`);
    console.log('='.repeat(80));
    console.log(`ID: ${player.id}`);
    console.log(`Name: "${player.name}" (length: ${player.name.length})`);
    console.log(`Name (hex): ${Buffer.from(player.name).toString('hex')}`);
    console.log(`Team: ${player.team}`);
    console.log(`Position: ${player.position}`);
    console.log(`Overall: ${player.overall || 'NULL'}`);
    console.log(`Expected Contribution: ${player.expectedContribution}`);
    console.log(`Predicted Minutes: ${player.predictedMinutes}`);
    console.log(`Stat Probability: ${player.statProbability}`);
    console.log(`Last 5 Avg: ${player.last5Avg}`);
    console.log(`Stat 90: ${player.stat90}`);
    console.log(`Stat Type: ${player.statType}`);
    console.log(`Player Face URL: ${player.playerFaceUrl || 'NULL'}`);
    console.log(`Image URL: ${player.imageUrl || 'NULL'}`);
    console.log(`Radar Stats: ${player.radarStats ? JSON.stringify(player.radarStats) : 'NULL'}`);
    console.log(`SoFIFA ID: ${player.sofifaId || 'NULL'}`);
    console.log(`SoFIFA URL: ${player.sofifaUrl || 'NULL'}`);
  });
  
  // Check normalized versions
  console.log(`\n${'='.repeat(80)}`);
  console.log('NORMALIZED NAMES:');
  console.log('='.repeat(80));
  wirtzPlayers.forEach(p => {
    const normalized = p.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    console.log(`"${p.name}" → "${normalized}"`);
  });
  
  // Check for Liverpool players
  console.log(`\n${'='.repeat(80)}`);
  console.log('LIVERPOOL PLAYERS (sample):');
  console.log('='.repeat(80));
  const liverpoolPlayers = await db.select().from(players).where(
    sql`${players.team} = 'Liverpool'`
  );
  console.log(`Total Liverpool players: ${liverpoolPlayers.length}`);
  liverpoolPlayers.slice(0, 10).forEach(p => {
    console.log(`  - ${p.name} (${p.id}) - Expected: ${p.expectedContribution}`);
  });
}

checkWirtz()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

