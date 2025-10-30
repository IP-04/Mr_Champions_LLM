import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function checkMbappe() {
  console.log('\n🔍 Checking Kylian Mbappe...\n');
  
  const mbappes = await db.select().from(players).where(
    sql`LOWER(${players.name}) LIKE '%mbappe%'`
  );
  
  console.log(`Found ${mbappes.length} Mbappe record(s):\n`);
  
  mbappes.forEach((player, idx) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${idx + 1}] ${player.name} (${player.id})`);
    console.log('='.repeat(80));
    console.log(`Team: ${player.team}`);
    console.log(`SofifaId: ${player.sofifaId || 'NULL'}`);
    console.log(`SofifaUrl: ${player.sofifaUrl || 'NULL'}`);
    console.log(`PlayerFaceUrl: ${player.playerFaceUrl || 'NULL'}`);
    console.log(`RadarStats: ${player.radarStats ? JSON.stringify(player.radarStats) : 'NULL'}`);
    
    if (player.radarStats) {
      const stats = player.radarStats as any;
      console.log(`\nRadar Stats Breakdown:`);
      console.log(`  Pace: ${stats.pace}`);
      console.log(`  Shooting: ${stats.shooting}`);
      console.log(`  Passing: ${stats.passing}`);
      console.log(`  Dribbling: ${stats.dribbling}`);
      console.log(`  Defending: ${stats.defending}`);
      console.log(`  Physical: ${stats.physical}`);
      
      const allZero = stats.pace === 0 && stats.shooting === 0 && stats.passing === 0;
      console.log(`\n  ⚠️ All zeros: ${allZero ? 'YES - NEEDS SCRAPING' : 'NO - OK'}`);
    }
  });
}

checkMbappe()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

