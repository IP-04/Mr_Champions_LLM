import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function checkMergedPlayers() {
  console.log('\n🔍 Checking merged Liverpool players...\n');
  
  const liverpoolPlayers = await db.select().from(players).where(
    sql`${players.team} = 'Liverpool'`
  );
  
  console.log(`Total Liverpool players: ${liverpoolPlayers.length}\n`);
  
  const problematic = liverpoolPlayers.filter(p => 
    p.name.includes('Wirtz') || 
    p.name.includes('Dijk') || 
    p.name.includes('Isak') ||
    p.name.includes('Salah')
  );
  
  console.log('Players with potential image issues:\n');
  
  problematic.forEach(player => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${player.name} (${player.id})`);
    console.log('='.repeat(80));
    console.log(`PlayerFaceUrl: ${player.playerFaceUrl || 'NULL'}`);
    console.log(`ImageUrl: ${player.imageUrl || 'NULL'}`);
    console.log(`SofifaId: ${player.sofifaId || 'NULL'}`);
    console.log(`Overall: ${player.overall || 'NULL'}`);
    console.log(`Expected: ${player.expectedContribution}`);
    console.log(`RadarStats: ${player.radarStats ? JSON.stringify(player.radarStats) : 'NULL'}`);
  });
  
  // Count how many are missing images
  const missingImages = liverpoolPlayers.filter(p => 
    !p.playerFaceUrl || p.playerFaceUrl.includes('ui-avatars')
  );
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   Total Liverpool players: ${liverpoolPlayers.length}`);
  console.log(`   Missing real images: ${missingImages.length}`);
  console.log('='.repeat(80) + '\n');
}

checkMergedPlayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

