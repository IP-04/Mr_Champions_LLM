import { db } from "../db";
import { players } from "../shared/schema";

async function checkPlayerImages() {
  console.log('🔍 Checking player image data...\n');
  
  const allPlayers = await db.select().from(players);
  
  console.log(`📊 Total players in database: ${allPlayers.length}\n`);
  
  let hasImageUrl = 0;
  let hasPlayerFaceUrl = 0;
  let hasNeither = 0;
  let hasBoth = 0;
  
  console.log('Sample players:');
  console.log('================');
  
  allPlayers.slice(0, 10).forEach((player, idx) => {
    console.log(`\n${idx + 1}. ${player.name} (${player.team}) - ${player.position}`);
    console.log(`   imageUrl: ${player.imageUrl ? player.imageUrl.substring(0, 50) + '...' : 'EMPTY'}`);
    console.log(`   playerFaceUrl: ${player.playerFaceUrl || 'NULL'}`);
    console.log(`   sofifaUrl: ${player.sofifaUrl || 'NULL'}`);
    console.log(`   lastScraped: ${player.lastScraped || 'NEVER'}`);
  });
  
  // Count statistics
  allPlayers.forEach(player => {
    const hasImg = player.imageUrl && player.imageUrl.length > 0;
    const hasFace = player.playerFaceUrl && player.playerFaceUrl.length > 0;
    
    if (hasImg && hasFace) {
      hasBoth++;
    } else if (hasImg) {
      hasImageUrl++;
    } else if (hasFace) {
      hasPlayerFaceUrl++;
    } else {
      hasNeither++;
    }
  });
  
  console.log('\n\n📊 Image Statistics:');
  console.log('====================');
  console.log(`Players with both imageUrl and playerFaceUrl: ${hasBoth}`);
  console.log(`Players with only imageUrl: ${hasImageUrl}`);
  console.log(`Players with only playerFaceUrl: ${hasPlayerFaceUrl}`);
  console.log(`Players with neither: ${hasNeither}`);
  
  console.log('\n💡 Recommendations:');
  console.log('===================');
  
  if (hasNeither > 0 || (hasPlayerFaceUrl === 0 && hasImageUrl === 0)) {
    console.log('⚠️  Most players have no images!');
    console.log('   1. Run: npm run db:migrate to ensure player_face_url column exists');
    console.log('   2. Trigger sync: POST to /api/admin/sync-players');
    console.log('   3. Or use curl: curl -X POST http://localhost:5000/api/admin/sync-players -H "Content-Type: application/json" -d "{\\"limit\\":50}"');
  } else if (hasPlayerFaceUrl < allPlayers.length * 0.5) {
    console.log('⚠️  Less than 50% of players have scraped images');
    console.log('   → Run the SoFIFA sync to populate playerFaceUrl');
    console.log('   → POST to /api/admin/sync-players with desired limit');
  } else {
    console.log('✅ Most players have images!');
    console.log('   → If images still not showing, check browser console for CORS/loading errors');
  }
  
  process.exit(0);
}

checkPlayerImages().catch(console.error);
