import { db } from "../db";
import { players } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Update all players without playerFaceUrl to have nice avatar URLs
 */
async function updatePlayerAvatars() {
  console.log('🔄 Updating player avatar URLs...\n');
  
  try {
    // Get all players
    const allPlayers = await db.select().from(players);
    console.log(`📊 Found ${allPlayers.length} total players\n`);
    
    // Filter players that need avatar updates (no playerFaceUrl or empty imageUrl)
    const playersNeedingUpdate = allPlayers.filter(p => 
      !p.playerFaceUrl || !p.imageUrl || p.imageUrl.length === 0 || p.imageUrl.includes('unsplash')
    );
    
    console.log(`🎯 ${playersNeedingUpdate.length} players need avatar updates\n`);
    
    if (playersNeedingUpdate.length === 0) {
      console.log('✅ All players already have images!');
      process.exit(0);
    }
    
    let updateCount = 0;
    
    for (const player of playersNeedingUpdate) {
      // Generate avatar URL based on initials and position
      const initials = player.name.split(' ').map(n => n[0]).join('').substring(0, 2);
      const positionColors: Record<string, string> = { 
        'FWD': 'e53e3e',  // Red
        'MID': '38a169',  // Green
        'DEF': '3182ce',  // Blue
        'GK': 'ecc94b'    // Yellow
      };
      const color = positionColors[player.position] || '718096';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=200&bold=true`;
      
      // Update the player
      await db.update(players)
        .set({ imageUrl: avatarUrl })
        .where(eq(players.id, player.id));
      
      updateCount++;
      
      if (updateCount % 50 === 0) {
        console.log(`   Updated ${updateCount}/${playersNeedingUpdate.length} players...`);
      }
    }
    
    console.log(`\n✅ Successfully updated ${updateCount} players with avatar URLs!`);
    console.log('\n📋 Summary:');
    console.log(`   - Total players: ${allPlayers.length}`);
    console.log(`   - Updated with avatars: ${updateCount}`);
    console.log(`   - Players with SoFIFA photos: ${allPlayers.filter(p => p.playerFaceUrl).length}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Refresh your browser (hard refresh: Ctrl+Shift+R)');
    console.log('   2. You should now see colored avatars for all players');
    console.log('   3. Run SoFIFA sync to replace avatars with real photos');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating avatars:', error);
    process.exit(1);
  }
}

updatePlayerAvatars();
