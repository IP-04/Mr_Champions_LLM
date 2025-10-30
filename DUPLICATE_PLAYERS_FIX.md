# Duplicate Players Fix

## 🛑 Critical Issue Identified

**Problem**: Same player appears twice with different data:
- **"F. Wirtz"** (ID: xxx) - Has stats but NO image
- **"Florian Wirtz"** (ID: yyy) - Has image but ALL STATS = 0

This is a **database duplication** issue caused by:
1. Different name formats (abbreviated vs full)
2. Separate sync jobs creating different records
3. No unique constraint preventing duplicates
4. Stats and images attaching to different records

## 📊 Diagnosis Steps

### Step 1: Find All Duplicates

```bash
npm run find-duplicates
```

This will:
- Normalize all player names (remove dots, lowercase, trim spaces)
- Group players by normalized name
- Show detailed comparison of duplicate records
- Display which record has better data (images, stats, overall rating)

**Example Output:**
```
👥 "florian wirtz" - 2 records
================================================================================

[1] Florian Wirtz (ID: real_madrid_231747)
    Team: Real Madrid
    Overall: 93
    PlayerFaceUrl: /player-images/231747_kylian_mbappe.png
    RadarStats: {"pace":0,"shooting":0,"passing":0,...}  ← ALL ZEROS
    Expected: 0.32
    
[2] F. Wirtz (ID: player-123456)
    Team: Liverpool
    Overall: NULL
    PlayerFaceUrl: NULL  ← NO IMAGE
    RadarStats: NULL
    Expected: 0.8  ← HAS STATS
```

### Step 2: Review Merge Plan (DRY RUN)

```bash
npm run merge-duplicates
```

This will:
- Show which record will be KEPT (higher completeness score)
- Show which records will be MERGED and DELETED
- Display the merge strategy for each duplicate group
- **NOT** make any changes (safe to run)

**Scoring System** (higher = better):
- Real player face image: +10 points
- Valid radar stats (pace > 0): +10 points
- Overall rating > 0: +5 points
- SofifaId present: +5 points
- Expected contribution > 0: +3 points
- Full name (no dots): +0 points
- Abbreviated name (has dots): -5 points

### Step 3: Apply Merge (LIVE RUN)

```bash
npm run merge-duplicates -- --live
```

⚠️ **WARNING**: This will:
- Merge all data fields from duplicates into the best record
- DELETE duplicate records permanently
- Update the keep record with combined data from all duplicates

**Merge Logic**:
```typescript
// For each duplicate group:
1. Keep record with highest completeness score
2. Merge data from all duplicates:
   - Take playerFaceUrl if keep record missing it
   - Take radarStats if keep record missing it
   - Take highest expectedContribution
   - Take highest statProbability
   - Take highest last5Avg
   - Take highest stat90
   - Take overall if keep record is 0/NULL
   - Take sofifaId/sofifaUrl if missing
3. Update keep record with merged data
4. Delete all duplicate records
```

## 🔧 Root Cause & Prevention

### Why This Happened

1. **Multiple data sources with different name formats**:
   - API-Football: "F. Wirtz" (abbreviated)
   - SoFIFA: "Florian Wirtz" (full name)
   - CSV import: "Wirtz, Florian" (last, first)

2. **No unique constraint on players table**:
   - Database allows multiple records with similar names
   - No check for (firstName + lastName + DOB + team)

3. **Separate sync jobs**:
   - `sync-top-players-playwright.ts` → Creates records with images
   - `playerStatsGenerator.ts` → Creates records with stats
   - Each uses different player identifiers

### How to Prevent

#### 1. Add Unique Constraint (Database Migration)

```sql
-- Create unique constraint on sofifaId
ALTER TABLE players ADD CONSTRAINT unique_sofifa_id 
  UNIQUE (sofifa_id) WHERE sofifa_id IS NOT NULL;

-- Create unique constraint on normalized name + team
CREATE UNIQUE INDEX unique_player_team 
  ON players (LOWER(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g')), team);
```

#### 2. Update Sync Logic (Code Change)

In `sync-player-data.ts`:
```typescript
// Before insert, check for existing player
const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
const existing = await db.select()
  .from(players)
  .where(sql`LOWER(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g')) = ${normalized}
             AND team = ${team}`);

if (existing.length > 0) {
  // UPDATE existing record instead of INSERT
  await db.update(players)
    .set({ /* merged data */ })
    .where(eq(players.id, existing[0].id));
} else {
  // INSERT new record
  await db.insert(players).values({ /* data */ });
}
```

#### 3. Standardize Player Identifiers

Use `sofifaId` as the canonical unique identifier:
```typescript
// Always use sofifaId when available
const playerId = player.sofifaId 
  ? `sofifa_${player.sofifaId}` 
  : `generated_${team}_${normalizedName}`;
```

## 📋 Action Plan

### Immediate (Fix Current Data)

1. ✅ Run `npm run find-duplicates` to audit current state
2. ✅ Review output - confirm which records should be kept
3. ✅ Run `npm run merge-duplicates` (dry run) to see merge plan
4. ✅ If plan looks good, run `npm run merge-duplicates -- --live`
5. ✅ Verify in UI that duplicates are gone and data is complete

### Short-term (Prevent New Duplicates)

1. Update sync scripts to check for existing players before insert
2. Normalize names consistently across all sync jobs
3. Use `sofifaId` as primary identifier where available

### Long-term (Database Integrity)

1. Add unique constraint on `sofifaId`
2. Add composite unique index on normalized_name + team
3. Add data validation in API layer (reject duplicate inserts)
4. Set up automated duplicate detection job (runs weekly)

## 🧪 Testing After Merge

1. **Check player count**:
   ```sql
   SELECT COUNT(*) FROM players;
   -- Should decrease by number of duplicates
   ```

2. **Verify no duplicates remain**:
   ```bash
   npm run find-duplicates
   # Should show 0 duplicate groups
   ```

3. **Check UI**:
   - Go to match detail page
   - Verify only ONE card per player
   - Verify card has BOTH image AND stats
   - Verify team affiliation is correct

4. **Check specific player** (e.g., Wirtz):
   ```sql
   SELECT id, name, team, overall, "playerFaceUrl", "radarStats"
   FROM players 
   WHERE name ILIKE '%wirtz%';
   -- Should return only 1 record with complete data
   ```

## 📊 Expected Results

**Before Merge**:
- Total players: ~850
- Duplicate groups: ~50-100
- Cards showing: Some with images, some with stats

**After Merge**:
- Total players: ~750-800
- Duplicate groups: 0
- Cards showing: Complete data (images + stats + ratings)

## 🆘 Rollback Plan

If something goes wrong:

1. **Restore from database backup** (if available):
   ```bash
   pg_restore -d your_db your_backup.dump
   ```

2. **Re-run sync jobs** to repopulate:
   ```bash
   npm run sync-players -- --limit 1000
   ```

3. **Check logs** for any errors during merge

## 📝 Notes

- The merge script uses a **completeness scoring system** to decide which record to keep
- Records with real images and valid radar stats score highest
- Abbreviated names (e.g., "F. Wirtz") score lower than full names
- All data from duplicates is preserved in the kept record
- This is a **one-time fix** - prevention logic should be added to sync scripts

