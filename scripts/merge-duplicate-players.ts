import { db } from '../db/index.js';
import { players } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

interface MergeDecision {
  keepId: string;
  mergeIds: string[];
  reason: string;
}

async function mergeDuplicatePlayers(dryRun: boolean = true) {
  console.log(`\n🔄 ${dryRun ? 'DRY RUN' : 'LIVE RUN'} - Merging duplicate players...\n`);
  
  // Find potential duplicates by similar names
  const allPlayers = await db.select().from(players);
  
  const nameMap = new Map<string, typeof allPlayers>();
  
  for (const player of allPlayers) {
    const normalized = player.name
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract last name (last word after splitting)
    const parts = normalized.split(' ');
    const lastName = parts[parts.length - 1];
    
    // Use last name + team as key to catch abbreviated vs full name duplicates
    const key = `${lastName}|${player.team}`;
    
    if (!nameMap.has(key)) {
      nameMap.set(key, []);
    }
    nameMap.get(key)!.push(player);
  }
  
  const mergeDecisions: MergeDecision[] = [];
  
  // Decide which record to keep for each duplicate group
  for (const [normalizedName, playerGroup] of nameMap.entries()) {
    if (playerGroup.length <= 1) continue;
    
    // Sort by completeness score (higher = better)
    const scored = playerGroup.map(p => ({
      player: p,
      score: 
        (p.playerFaceUrl && !p.playerFaceUrl.includes('ui-avatars') ? 10 : 0) +
        (p.radarStats && (p.radarStats as any).pace > 0 ? 10 : 0) +
        (p.overall && p.overall > 0 ? 5 : 0) +
        (p.sofifaId ? 5 : 0) +
        (p.expectedContribution > 0 ? 3 : 0) +
        (p.statProbability > 0 ? 3 : 0) +
        (p.last5Avg > 0 ? 3 : 0) +
        (p.stat90 > 0 ? 3 : 0) +
        (p.name.includes('.') ? -5 : 0) // Prefer full names
    })).sort((a, b) => b.score - a.score);
    
    const keepRecord = scored[0].player;
    const mergeRecords = scored.slice(1).map(s => s.player);
    
    mergeDecisions.push({
      keepId: keepRecord.id,
      mergeIds: mergeRecords.map(r => r.id),
      reason: `Keep "${keepRecord.name}" (score: ${scored[0].score}), merge ${mergeRecords.length} duplicate(s)`
    });
  }
  
  console.log(`Found ${mergeDecisions.length} merge operations to perform:\n`);
  
  let mergedCount = 0;
  
  for (const decision of mergeDecisions) {
    const keepPlayer = allPlayers.find(p => p.id === decision.keepId)!;
    const mergePlayers = allPlayers.filter(p => decision.mergeIds.includes(p.id));
    
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`✅ KEEP: ${keepPlayer.name} (${keepPlayer.id})`);
    console.log(`   Team: ${keepPlayer.team} | Face: ${keepPlayer.playerFaceUrl ? '✓' : '✗'} | Radar: ${keepPlayer.radarStats ? '✓' : '✗'}`);
    
    for (const mergePlayer of mergePlayers) {
      console.log(`\n❌ MERGE: ${mergePlayer.name} (${mergePlayer.id})`);
      console.log(`   Team: ${mergePlayer.team} | Face: ${mergePlayer.playerFaceUrl ? '✓' : '✗'} | Radar: ${mergePlayer.radarStats ? '✓' : '✗'}`);
    }
    
    if (!dryRun) {
      try {
        // Merge data from all duplicates into the keep record
        const mergedData: any = { ...keepPlayer };
        
        for (const mergePlayer of mergePlayers) {
          // Take the best data from each field
          if (!mergedData.playerFaceUrl && mergePlayer.playerFaceUrl) {
            mergedData.playerFaceUrl = mergePlayer.playerFaceUrl;
          }
          if (!mergedData.radarStats && mergePlayer.radarStats) {
            mergedData.radarStats = mergePlayer.radarStats;
          }
          if ((!mergedData.overall || mergedData.overall === 0) && mergePlayer.overall) {
            mergedData.overall = mergePlayer.overall;
          }
          if ((!mergedData.sofifaId) && mergePlayer.sofifaId) {
            mergedData.sofifaId = mergePlayer.sofifaId;
          }
          if ((!mergedData.sofifaUrl) && mergePlayer.sofifaUrl) {
            mergedData.sofifaUrl = mergePlayer.sofifaUrl;
          }
          if (mergePlayer.expectedContribution > mergedData.expectedContribution) {
            mergedData.expectedContribution = mergePlayer.expectedContribution;
          }
          if (mergePlayer.statProbability > mergedData.statProbability) {
            mergedData.statProbability = mergePlayer.statProbability;
          }
          if (mergePlayer.last5Avg > mergedData.last5Avg) {
            mergedData.last5Avg = mergePlayer.last5Avg;
          }
          if (mergePlayer.stat90 > mergedData.stat90) {
            mergedData.stat90 = mergePlayer.stat90;
          }
        }
        
        // Update the keep record with merged data
        await db.update(players)
          .set(mergedData)
          .where(eq(players.id, decision.keepId));
        
        // Delete the duplicate records
        for (const mergeId of decision.mergeIds) {
          await db.delete(players).where(eq(players.id, mergeId));
        }
        
        mergedCount++;
        console.log(`   ✓ Merged and deleted duplicates`);
      } catch (error) {
        console.log(`   ❌ Failed to merge: ${error}`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 MERGE SUMMARY:`);
  console.log(`   Total merge operations: ${mergeDecisions.length}`);
  if (!dryRun) {
    console.log(`   Successfully merged: ${mergedCount}`);
  } else {
    console.log(`   ⚠️  DRY RUN - No changes made to database`);
    console.log(`   Run with --live flag to apply changes`);
  }
  console.log('='.repeat(80) + '\n');
}

// Parse command line args
const args = process.argv.slice(2);
const isLive = args.includes('--live');

mergeDuplicatePlayers(!isLive)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

