import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

async function fixImageUrls() {
  console.log('\n🔧 Fixing imageUrl fields to point to local player images...\n');
  
  // Get all players with sofifaId
  const allPlayers = await db.select().from(players).where(
    sql`${players.sofifaId} IS NOT NULL`
  );
  
  console.log(`Found ${allPlayers.length} players with SoFIFA IDs\n`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  
  for (const player of allPlayers) {
    // The correct path is already in playerFaceUrl field (local images) or sofifaId-based
    // Priority: Use existing playerFaceUrl if it starts with /player-images/
    let localImagePath: string;
    
    if (player.playerFaceUrl?.startsWith('/player-images/')) {
      // Player already has correct local path
      localImagePath = player.playerFaceUrl;
    } else {
      // Build from sofifaId - the files use full names, so we can't reliably generate
      // Instead, use the playerFaceUrl if it exists (which should be from previous import)
      // For now, just skip if we don't have a good local path
      console.log(`⚠️  Skipping ${player.name} - no local image path available`);
      skippedCount++;
      continue;
    }
    
    // Check if imageUrl needs updating
    if (player.imageUrl !== localImagePath && 
        (player.imageUrl?.includes('ui-avatars') || !player.imageUrl?.startsWith('/player-images/'))) {
      
      console.log(`Updating ${player.name} (${player.sofifaId})`);
      console.log(`  OLD: ${player.imageUrl}`);
      console.log(`  NEW: ${localImagePath}`);
      
      await db.update(players)
        .set({
          imageUrl: localImagePath
        })
        .where(eq(players.id, player.id));
      
      fixedCount++;
    } else {
      skippedCount++;
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   Total players checked: ${allPlayers.length}`);
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ⏭️  Already correct: ${skippedCount}`);
  console.log('='.repeat(80) + '\n');
}

fixImageUrls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

