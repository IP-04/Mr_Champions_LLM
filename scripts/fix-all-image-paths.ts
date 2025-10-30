import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function fixAllImagePaths() {
  console.log('\n🔧 Fixing ALL image paths to point to local files...\n');
  
  // Get list of all local player image files
  const imageDir = join(process.cwd(), 'client', 'public', 'player-images');
  const allFiles = await readdir(imageDir);
  
  // Create map of sofifaId -> filename
  const sofifaIdToFile = new Map<string, string>();
  
  for (const file of allFiles) {
    if (file.endsWith('.png') && !file.startsWith('player-')) {
      // Extract sofifaId from filename (e.g., "252371_jude_bellingham.png" -> "252371")
      const sofifaId = file.split('_')[0];
      sofifaIdToFile.set(sofifaId, file);
    }
  }
  
  console.log(`Found ${sofifaIdToFile.size} local player images with SoFIFA IDs\n`);
  
  // Get all players from database
  const allPlayers = await db.select().from(players);
  
  let fixedCount = 0;
  let notFoundCount = 0;
  
  for (const player of allPlayers) {
    if (!player.sofifaId) {
      continue; // Skip players without sofifaId
    }
    
    const localFile = sofifaIdToFile.get(player.sofifaId);
    
    if (!localFile) {
      console.log(`⚠️  No local file for ${player.name} (${player.sofifaId})`);
      notFoundCount++;
      continue;
    }
    
    const localImagePath = `/player-images/${localFile}`;
    
    // Update both playerFaceUrl and imageUrl to point to local file
    const needsUpdate = 
      player.playerFaceUrl !== localImagePath || 
      player.imageUrl !== localImagePath;
    
    if (needsUpdate) {
      console.log(`Updating ${player.name} (${player.sofifaId})`);
      console.log(`  playerFaceUrl: ${player.playerFaceUrl} → ${localImagePath}`);
      console.log(`  imageUrl: ${player.imageUrl} → ${localImagePath}`);
      
      await db.update(players)
        .set({
          playerFaceUrl: localImagePath,
          imageUrl: localImagePath
        })
        .where(eq(players.id, player.id));
      
      fixedCount++;
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   Local image files: ${sofifaIdToFile.size}`);
  console.log(`   ✅ Players updated: ${fixedCount}`);
  console.log(`   ⚠️  No local file found: ${notFoundCount}`);
  console.log('='.repeat(80) + '\n');
}

fixAllImagePaths()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

