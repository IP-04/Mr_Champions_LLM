import { db } from '../db/index.js';
import { players } from '../shared/schema.js';

async function checkPlayerImages() {
  console.log('🔍 Checking player image URLs in database...\n');
  
  const result = await db.select({
    id: players.id,
    name: players.name,
    team: players.team,
    playerFaceUrl: players.playerFaceUrl,
    imageUrl: players.imageUrl,
  }).from(players).limit(20);
  
  console.log('First 20 players:');
  result.forEach((player, i) => {
    console.log(`\n${i + 1}. ${player.name} (${player.team})`);
    console.log(`   playerFaceUrl: ${player.playerFaceUrl || 'NULL'}`);
    console.log(`   imageUrl: ${player.imageUrl || 'NULL'}`);
  });
  
  const withFaceUrls = result.filter(p => p.playerFaceUrl);
  const withImageUrls = result.filter(p => p.imageUrl);
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary of first 20 players:`);
  console.log(`   With playerFaceUrl: ${withFaceUrls.length}/20`);
  console.log(`   With imageUrl: ${withImageUrls.length}/20`);
  console.log('='.repeat(60));
}

checkPlayerImages()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

