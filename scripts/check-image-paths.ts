import { db } from "../db";
import { players } from "../shared/schema";

async function checkImagePaths() {
  console.log('🔍 Checking what image paths are in the database...\n');
  
  const allPlayers = await db.select().from(players);
  
  const localImages = allPlayers.filter(p => p.imageUrl && p.imageUrl.startsWith('/player-images/'));
  const uiAvatars = allPlayers.filter(p => p.imageUrl && p.imageUrl.includes('ui-avatars.com'));
  const sofifaCDN = allPlayers.filter(p => p.imageUrl && p.imageUrl.includes('cdn.sofifa.net'));
  const unsplash = allPlayers.filter(p => p.imageUrl && p.imageUrl.includes('unsplash'));
  const empty = allPlayers.filter(p => !p.imageUrl || p.imageUrl === '');
  
  console.log('📊 Image URL Breakdown:');
  console.log('=======================');
  console.log(`Local files (/player-images/): ${localImages.length}`);
  console.log(`UI Avatars (generated): ${uiAvatars.length}`);
  console.log(`SoFIFA CDN (remote): ${sofifaCDN.length}`);
  console.log(`Unsplash (placeholder): ${unsplash.length}`);
  console.log(`Empty/null: ${empty.length}`);
  console.log(`Total: ${allPlayers.length}`);
  
  console.log('\n📋 Sample imageUrl values:');
  console.log('==========================');
  allPlayers.slice(0, 10).forEach(p => {
    console.log(`${p.name}: ${p.imageUrl || 'NULL'}`);
  });
  
  console.log('\n📋 Players with playerFaceUrl:');
  console.log('===============================');
  const withFaceUrl = allPlayers.filter(p => p.playerFaceUrl);
  console.log(`Count: ${withFaceUrl.length}`);
  withFaceUrl.slice(0, 5).forEach(p => {
    console.log(`${p.name}: ${p.playerFaceUrl}`);
  });
  
  if (localImages.length === 0) {
    console.log('\n❌ PROBLEM FOUND: No local image paths in database!');
    console.log('   The download script did NOT update the database.');
    console.log('   The images are downloaded but players still point to remote URLs.');
  } else {
    console.log(`\n✅ ${localImages.length} players have local image paths`);
  }
  
  process.exit(0);
}

checkImagePaths().catch(console.error);
