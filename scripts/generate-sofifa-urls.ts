import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

async function generateSofifaUrls() {
  console.log('\n🔗 Generating SoFIFA URLs from SoFIFA IDs...\n');
  
  // Get players with sofifaId but no sofifaUrl
  const playersToFix = await db.select().from(players).where(
    sql`${players.sofifaId} IS NOT NULL AND ${players.sofifaUrl} IS NULL`
  );
  
  console.log(`Found ${playersToFix.length} players with sofifaId but no sofifaUrl\n`);
  
  let fixedCount = 0;
  
  for (const player of playersToFix) {
    // Generate URL from sofifaId and normalized name
    const normalizedName = player.name
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const sofifaUrl = `https://sofifa.com/player/${player.sofifaId}/${normalizedName}/260006/`;
    
    console.log(`${player.name} (${player.sofifaId})`);
    console.log(`  → ${sofifaUrl}`);
    
    await db.update(players)
      .set({ sofifaUrl })
      .where(eq(players.id, player.id));
    
    fixedCount++;
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SUMMARY:`);
  console.log(`   ✅ SoFIFA URLs generated: ${fixedCount}`);
  console.log('='.repeat(80) + '\n');
}

generateSofifaUrls()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

