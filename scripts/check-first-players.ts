import { db } from "../db";
import { players } from "../shared/schema";

async function checkFirstPlayer() {
  console.log('🔍 Checking first player data that frontend receives...\n');
  
  const allPlayers = await db.select().from(players).limit(5);
  
  console.log('First 5 players as sent to API:');
  console.log('=================================\n');
  
  allPlayers.forEach((player, idx) => {
    console.log(`${idx + 1}. ${player.name} (${player.team})`);
    console.log(`   ID: ${player.id}`);
    console.log(`   imageUrl: ${player.imageUrl || 'NULL/EMPTY'}`);
    console.log(`   playerFaceUrl: ${player.playerFaceUrl || 'NULL/EMPTY'}`);
    console.log(`   Has imageUrl? ${Boolean(player.imageUrl && player.imageUrl.length > 0)}`);
    console.log(`   Has playerFaceUrl? ${Boolean(player.playerFaceUrl && player.playerFaceUrl.length > 0)}`);
    console.log('');
  });
  
  // Check if any players have EITHER image
  const playersWithAnyImage = allPlayers.filter(p => 
    (p.imageUrl && p.imageUrl.length > 0) || (p.playerFaceUrl && p.playerFaceUrl.length > 0)
  );
  
  console.log(`\n📊 ${playersWithAnyImage.length} out of 5 have at least one image URL`);
  
  if (playersWithAnyImage.length === 0) {
    console.log('\n❌ PROBLEM: None of the first 5 players have any image URLs!');
    console.log('   This explains why fallback icons are showing.');
    console.log('\n💡 Solution: You need to either:');
    console.log('   1. Run the SoFIFA sync to populate playerFaceUrl');
    console.log('   2. OR update existing imageUrl values');
  } else {
    console.log('\n✅ Some players have images, check browser console for loading errors');
  }
  
  process.exit(0);
}

checkFirstPlayer().catch(console.error);
