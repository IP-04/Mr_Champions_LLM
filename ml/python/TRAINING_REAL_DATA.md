# Training ML Models with Real Data

## Current Status

🟡 **Partial Implementation** - The database schema needs to be updated to store actual match results before we can train on real data.

## What's Missing

The `matches` table currently stores:
- Match predictions (homeWinProb, drawProb, awayWinProb)
- Expected goals predictions (homeXg, awayXg)
- Match metadata (teams, date, venue, etc.)

**Missing fields needed for training:**
- `homeGoals` (integer) - Actual goals scored by home team
- `awayGoals` (integer) - Actual goals scored by away team  
- `status` (text) - Match status: "SCHEDULED", "IN_PLAY", "FINISHED"
- `actualHomeXg` (real) - Actual home xG from match data
- `actualAwayXg` (real) - Actual away xG from match data

## Quick Start (Using Synthetic Data)

Until we have real match results, you can train models on synthetic data:

```powershell
cd ml/python

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Train all models on synthetic data
python train.py --model all --samples 1000

# Or use the quickstart script
python quickstart.py --train-only
```

## Training on Real Data (Future)

### Step 1: Update Database Schema

Add columns to the `matches` table:

```sql
ALTER TABLE matches
ADD COLUMN home_goals INTEGER,
ADD COLUMN away_goals INTEGER,
ADD COLUMN status VARCHAR(20) DEFAULT 'SCHEDULED',
ADD COLUMN actual_home_xg REAL,
ADD COLUMN actual_away_xg REAL;
```

Update the schema file (`shared/schema.ts`):

```typescript
export const matches = pgTable("matches", {
  // ... existing columns ...
  
  // Add these:
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
  status: varchar("status", { length: 20 }).default("SCHEDULED"),
  actualHomeXg: real("actual_home_xg"),
  actualAwayXg: real("actual_away_xg"),
});
```

### Step 2: Populate Historical Data

Create a script to backfill historical UCL matches:

```typescript
// scripts/backfill-historical-results.ts
import { db } from "../db";
import { matches } from "../shared/schema";

// Fetch historical results from Football Data API
// Update database with actual results
```

### Step 3: Export Training Data

Once you have real results, export them:

```powershell
# Run the Node.js export script
npm run export-training-data
```

This will create `ml/python/data/real_training_data.csv` with:
- 18 features (ELO, form, xG, etc.)
- Labels (match outcome, actual goals, actual xG)

### Step 4: Train Models

```powershell
cd ml/python

# Train on real data
python train_real_data.py
```

## Feature Engineering

The training pipeline calculates these 18 features:

1. **ELO Ratings**
   - `home_elo` - Home team ELO rating before match
   - `away_elo` - Away team ELO rating before match
   - `elo_diff` - Difference (home - away)

2. **Recent Form** (last 5 matches)
   - `home_form_last5` - Win rate (0-1)
   - `away_form_last5` - Win rate (0-1)
   - `home_goals_last5` - Average goals per game
   - `away_goals_last5` - Average goals per game
   - `home_xg_last5` - Average xG per game
   - `away_xg_last5` - Average xG per game

3. **Head-to-Head**
   - `h2h_home_wins` - Historical home wins in this fixture
   - `h2h_draws` - Historical draws
   - `h2h_away_wins` - Historical away wins

4. **Team Statistics**
   - `home_possession_avg` - Average possession %
   - `away_possession_avg` - Average possession %

5. **Match Context**
   - `venue_advantage` - Home advantage factor (0-1)
   - `stage_importance` - Tournament stage weight
   - `home_rest_days` - Days since last match
   - `away_rest_days` - Days since last match

## Model Performance Tracking

After training on real data, compare metrics:

**Synthetic Data Baseline:**
- Match Outcome Accuracy: 67.5%
- xG RMSE: 0.10

**Real Data Target:**
- Match Outcome Accuracy: >75%
- xG RMSE: <0.50

## Continuous Improvement

1. **Weekly Retraining**: Update models after each UCL matchday
2. **Feature Expansion**: Add player ratings, injuries, weather
3. **Model Comparison**: Test CatBoost, LightGBM alternatives
4. **Hyperparameter Tuning**: Grid search optimal parameters

## Troubleshooting

### "Insufficient real data available"

You need at least 10 finished matches in the database. Options:
1. Wait for more UCL matches to finish
2. Backfill historical UCL 2024-25 results
3. Use synthetic data for initial testing

### "Database connection failed"

Check your `.env` file has:
```
DATABASE_URL=postgresql://...
```

### "Models not improving"

- Verify data quality (no nulls, correct labels)
- Check feature correlations (SHAP analysis)
- Try different model architectures
- Add more training data

## Next Steps

1. ✅ Install dependencies (`psycopg2-binary`, `python-dotenv`)
2. ❌ Update database schema (add result columns)
3. ❌ Backfill historical match results
4. ❌ Export training data from database
5. ❌ Train models on real data
6. ❌ Deploy updated models to production

---

For immediate testing, use synthetic data training as shown above.
