# Player Data & ML Prediction System Setup

## Overview
This guide covers:
1. Syncing top 10 players per UCL team from SoFIFA
2. Training ML models for player performance predictions
3. Integrating predictions into the application

## Step 1: Sync Player Data from SoFIFA

### What it does:
- Fetches the top 10 players (by overall rating) for each Champions League team
- Downloads player face images to `client/public/player-images/`
- Updates database with:
  - Overall ratings and potential
  - Radar chart attributes (pace, shooting, passing, dribbling, defending, physical)
  - Player images
  - Position information
  - SoFIFA ID for reference

### How to run:

```powershell
# From project root
cd c:\Users\isaia\Desktop\Mr_Champions_LLM

# Run the sync script
tsx scripts/sync-top-players.ts
```

### Expected output:
```
⚽ SYNCING TOP 10 UCL PLAYERS PER TEAM
============================================================
📋 Teams to process: 29
🎯 Target: Top 10 players per team

🏆 Manchester City FC (SoFIFA ID: 10)
  📊 Found 28 players
  🎯 Processing top 10 players
  ✏️  Updated: Erling Haaland (91 OVR)
  ✏️  Updated: Kevin De Bruyne (91 OVR)
  ...
  ✅ Synced 10 players (0 new, 10 updated)

...

============================================================
✅ Sync Complete!
   Teams processed: 29/29
   Total players synced: 290
   Images saved to: client/public/player-images/
```

### What gets updated:
- **Player images**: `client/public/player-images/[playerId]_[name].png`
- **Database fields**:
  - `overall`: 70-95 (FIFA overall rating)
  - `potential`: Future potential rating
  - `radarStats`: Object with 6 attributes
  - `playerFaceUrl`: Path to downloaded image
  - `sofifaId`: Reference ID

---

## Step 2: Train Player Prediction Models

### What it does:
- Creates ML models to predict player statistics:
  - **Forwards**: goals, shots, assists, key_passes
  - **Midfielders**: assists, key_passes, goals, tackles, interceptions
  - **Defenders**: tackles, interceptions, clearances, blocks
  - **Goalkeepers**: saves, goals_conceded, clean_sheet

### How to run:

```powershell
# Activate Python environment
cd ml/python
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies (if not already installed)
pip install pandas numpy scikit-learn xgboost

# Train the models
python train_player_predictions.py
```

### Expected output:
```
⚽ TRAINING PLAYER PERFORMANCE PREDICTION MODELS
======================================================================

📊 Generating synthetic training data...
   Generated 5000 training samples
   Position distribution:
   MID    1754
   FWD    1489
   DEF    1505
   GK      252

🎯 Training Forward Models (Goals, Shots, Assists, Key Passes)

  📊 Training model for: FWD_goals
     Train MAE: 0.287
     Test MAE:  0.294
     Test R²:   0.652

  📊 Training model for: FWD_shots
     Train MAE: 0.531
     Test MAE:  0.548
     Test R²:   0.589

...

💾 Saving trained models...
   ✅ Saved: player_fwd_goals.json
   ✅ Saved: player_fwd_shots.json
   ✅ Saved: player_fwd_assists.json
   ...

✅ Training Complete!
   Models saved to: ml/python/models/trained
   Total models trained: 15
```

### Generated files:
- `ml/python/models/trained/player_fwd_goals.json`
- `ml/python/models/trained/player_fwd_shots.json`
- `ml/python/models/trained/player_mid_assists.json`
- `ml/python/models/trained/player_def_tackles.json`
- `ml/python/models/trained/player_gk_saves.json`
- ... (15 models total)
- `ml/python/models/trained/player_features.json` (configuration)

---

## Step 3: Restart ML Server with Player Predictions

### Start the FastAPI server:

```powershell
# From ml/python directory (with venv activated)
cd ml/python
python serve.py
```

### Test the new endpoint:

```powershell
# Health check (should show player_predictor: true)
curl http://localhost:8000/health

# Test player prediction
curl -X POST http://localhost:8000/predict/player `
  -H "Content-Type: application/json" `
  -d '{
    "player_name": "Erling Haaland",
    "position": "FWD",
    "features": {
      "overall_rating": 91,
      "pace": 89,
      "shooting": 91,
      "passing": 65,
      "dribbling": 80,
      "defending": 45,
      "physical": 88,
      "is_forward": 1,
      "is_midfielder": 0,
      "is_defender": 0,
      "is_goalkeeper": 0,
      "team_elo": 1950,
      "team_form_points": 12,
      "team_avg_goals_scored": 2.8,
      "team_avg_goals_conceded": 0.9,
      "opponent_elo": 1850,
      "opponent_def_rating": 82,
      "is_home": 1,
      "elo_differential": 100,
      "player_goals_last_5": 4,
      "player_assists_last_5": 1,
      "player_minutes_last_5": 450,
      "player_avg_rating_last_5": 8.2
    }
  }'
```

### Expected response:
```json
{
  "player_name": "Erling Haaland",
  "position": "FWD",
  "predictions": {
    "goals": 0.85,
    "shots": 4.2,
    "assists": 0.31,
    "key_passes": 1.8
  },
  "confidence": 0.75
}
```

---

## Integration with Frontend

The backend API endpoints in `server/routes.ts` will now call the ML server for player predictions.

### Update playerPredictionService.ts:

```typescript
// Call ML server instead of Poisson distribution
const mlPredictions = await fetch('http://localhost:8000/predict/player', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    player_name: player.name,
    position: player.position,
    features: {
      overall_rating: player.overall || 75,
      pace: player.radarStats?.pace || 70,
      shooting: player.radarStats?.shooting || 70,
      // ... other features
    }
  })
});

const result = await mlPredictions.json();
// Use result.predictions for player stats
```

---

## Troubleshooting

### SoFIFA API Rate Limiting
If you see `Rate limit reached`, the script will automatically wait. The API allows 60 requests/minute.

### Missing player images
Images are downloaded from `https://cdn.sofifa.net/players/[id]/[id].png`. If a player image fails, it falls back to `/player-images/default-player.png`.

### Model not loading
Ensure you've run `train_player_predictions.py` first. Models should be in `ml/python/models/trained/`.

### Database connection errors
Check your `.env` file has the correct `DATABASE_URL` for Neon PostgreSQL.

---

## Next Steps

1. ✅ Run `tsx scripts/sync-top-players.ts` to populate player data
2. ✅ Run `python ml/python/train_player_predictions.py` to train models
3. ✅ Start ML server: `python ml/python/serve.py`
4. 🔄 Update `playerPredictionService.ts` to use ML predictions
5. 🔄 Test predictions in the Match Detail page
6. 🔄 Verify radar charts display correctly with new attributes

---

## Data Quality Notes

### Current Implementation:
- Using **synthetic training data** (5000 samples)
- Generated from reasonable statistical distributions
- Based on player attributes, team strength, opposition

### Future Improvements:
- Collect real historical player match stats from API-Football
- Train on actual UCL player performances (2020-2024 seasons)
- Add more features: opponent tactics, weather, referee tendencies
- Implement ensemble models (XGBoost + LightGBM)
- Add uncertainty quantification for confidence intervals

### Expected Accuracy:
- **Synthetic data baseline**: 55-65% R² (moderate correlation)
- **With real data**: 70-80% R² (strong correlation expected)
- **Count stats** (goals, shots): MAE ~0.3-0.5
- **High-frequency stats** (tackles, passes): MAE ~1.0-2.0
