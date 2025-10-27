# Machine Learning Setup Guide

## Overview

This guide provides instructions for setting up, training, and deploying the Python ML prediction server for the UCL Performance Predictor platform.

## Architecture

```
┌──────────────────┐         HTTP          ┌───────────────────┐
│  Node.js Server  │  ◄────────────────►  │ Python ML Server  │
│  (TypeScript)    │    Port 8000          │   (FastAPI)       │
└──────────────────┘                       └───────────────────┘
         │                                          │
         │                                          │
    PostgreSQL                              XGBoost Models
    Database                                   + SHAP
```

## Python Environment Setup

### 1. Install Python Dependencies

From the project root:

```bash
cd ml/python
pip install -r requirements.txt
```

**Dependencies installed:**
- `xgboost>=2.0.0` - Gradient boosting for match outcome predictions
- `catboost>=1.2` - Alternative gradient boosting model
- `scikit-learn>=1.3.0` - Standard ML utilities and preprocessing
- `pandas>=2.1.0` - Data manipulation and analysis
- `numpy>=1.24.0` - Numerical computing
- `shap>=0.44.0` - Model explainability (SHAP values)
- `fastapi>=0.104.0` - High-performance API framework
- `uvicorn>=0.24.0` - ASGI server for FastAPI
- `pydantic>=2.4.0` - Data validation and settings management
- `joblib>=1.3.0` - Model serialization and persistence

### 2. Train Initial Models

**IMPORTANT:** After implementing the ML infrastructure, you must train the models before starting the FastAPI server. The models are not included in the repository and must be generated first.

The platform includes a training script that generates initial models using synthetic data. In production, replace this with real historical UCL data.

```bash
cd ml/python
python train.py --model all --samples 1000 --output-dir models/trained
```

**Note:** The training script was recently updated to generate all 18 features (including `away_rest_days`). If you have old models trained with 17 features, you must retrain them to avoid shape mismatch errors.

**Training options:**
- `--model` - Which model to train: `match`, `xg`, or `all` (default: `all`)
- `--samples` - Number of training samples (default: 1000)
- `--output-dir` - Output directory for trained models (default: `models/trained`)

**Output:**
- `match_outcome_model.pkl` - XGBoost classifier for win/draw/loss predictions
- `xg_home_model.pkl` - XGBoost regressor for home team expected goals
- `xg_away_model.pkl` - XGBoost regressor for away team expected goals
- `training_summary.json` - Training metrics and metadata

**Sample output:**
```
=================================
Training Match Outcome Predictor
=================================

Generating 1000 training samples...
Training XGBoost classifier...

📊 Training Metrics:
{
  "accuracy": 0.742,
  "precision": 0.738,
  "recall": 0.742,
  "f1_score": 0.739
}

💾 Saving model to models/trained/match_outcome_model.pkl...

🎯 Sample Prediction:
{
  "home_win_prob": 0.58,
  "draw_prob": 0.24,
  "away_win_prob": 0.18,
  "confidence": 0.85
}

📈 Top 5 Features:
  elo_diff........................ 0.2134
  home_form_last5................. 0.1523
  home_xg_last5................... 0.1245
  h2h_home_wins................... 0.0987
  stage_importance................ 0.0876
```

### 3. Start the FastAPI ML Server

```bash
cd ml/python
uvicorn serve:app --reload --host 0.0.0.0 --port 8000
```

**Server endpoints:**
- `GET /health` - Health check and model status
- `POST /predict/match` - Get match outcome predictions
- `POST /explain/match` - Get predictions with SHAP explanations
- `GET /features/importance` - Get global feature importance

**Health check response:**
```json
{
  "status": "healthy",
  "models_loaded": {
    "match_outcome": true,
    "xg_home": true,
    "xg_away": true
  },
  "version": "1.0.0"
}
```

### 4. Verify ML Server Integration

Test the integration from the Node.js server:

```bash
# In a separate terminal, from project root:
npm run dev

# Check server logs for ML status:
# ✅ Python ML server is available
# or
# ⚠️  Python ML server not available, will use fallback predictions
```

## Feature Engineering

The ML models use 18 engineered features for predictions:

### Team Strength Features
- `home_elo` - ELO rating of home team (1300-2000)
- `away_elo` - ELO rating of away team (1300-2000)
- `elo_diff` - ELO difference (home - away)

### Recent Form Features (Last 5 matches)
- `home_form_last5` - Points per game (0-3)
- `away_form_last5` - Points per game (0-3)
- `home_goals_last5` - Total goals scored
- `away_goals_last5` - Total goals scored
- `home_xg_last5` - Total expected goals
- `away_xg_last5` - Total expected goals

### Head-to-Head Features
- `h2h_home_wins` - Historical home wins
- `h2h_draws` - Historical draws
- `h2h_away_wins` - Historical away wins

### Match Context Features
- `home_possession_avg` - Average possession % (30-75%)
- `away_possession_avg` - Average possession % (30-75%)
- `venue_advantage` - Home venue factor (0-1.2)
- `stage_importance` - Tournament stage weight (1-10)
- `home_rest_days` - Days since last match (0-7)
- `away_rest_days` - Days since last match (0-7)

Features are calculated in `server/ml/featureEngineering.ts` and passed to the Python ML server via HTTP.

## Model Training with Real Data

To train models with actual historical UCL data:

1. **Collect historical match data** from football-data.org API:
```bash
# Create a data collection script
python ml/python/scripts/collect_historical_data.py --seasons 5
```

2. **Prepare training dataset**:
```python
# In ml/python/scripts/prepare_training_data.py
import pandas as pd

# Load historical matches
matches = pd.read_csv('data/historical_matches.csv')

# Calculate features for each match
# ... feature engineering logic ...

# Save training data
train_data.to_csv('data/training_data.csv', index=False)
```

3. **Train models on real data**:
```bash
python train.py --data data/training_data.csv --model all --output-dir models/production
```

4. **Evaluate model performance**:
```bash
python ml/python/scripts/evaluate.py --model models/production/match_outcome_model.pkl
```

## SHAP Explainability

The platform uses SHAP (SHapley Additive exPlanations) to explain model predictions:

### How SHAP Works

SHAP values show the contribution of each feature to a specific prediction:

- **Positive SHAP value** → Feature pushes prediction higher
- **Negative SHAP value** → Feature pushes prediction lower
- **Zero SHAP value** → Feature has no impact

### Example SHAP Explanation

For Real Madrid (home) vs Manchester City (away):

```json
{
  "home_win_prob": 0.58,
  "draw_prob": 0.24,
  "away_win_prob": 0.18,
  "shap_values": {
    "elo_diff": +0.12,          // Home has higher ELO
    "home_form_last5": +0.08,   // Home in good form
    "venue_advantage": +0.05,   // Playing at home
    "h2h_home_wins": +0.03,     // Historical advantage
    "away_xg_last5": -0.04      // City strong in attack
  },
  "top_factors": {
    "positive": [
      {"feature": "elo_diff", "impact": 0.12},
      {"feature": "home_form_last5", "impact": 0.08}
    ],
    "negative": [
      {"feature": "away_xg_last5", "impact": -0.04}
    ]
  }
}
```

## Deployment Considerations

### Production Checklist

- [ ] Train models on real historical data (not synthetic)
- [ ] Set up model versioning and tracking (MLflow)
- [ ] Implement model monitoring and drift detection
- [ ] Add model retraining pipeline (weekly/monthly)
- [ ] Configure environment variables:
  - `ML_SERVER_URL` - FastAPI server URL (default: http://localhost:8000)
  - `ML_MODEL_PATH` - Path to trained models directory
- [ ] Set up health checks and monitoring
- [ ] Implement rate limiting for ML API
- [ ] Add caching for frequently requested predictions (Redis)
- [ ] Configure load balancing for ML server replicas
- [ ] Set up CI/CD for model deployment

### Docker Deployment (Future)

```dockerfile
# ml/python/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and run
docker build -t ucl-ml-server ml/python
docker run -p 8000:8000 -v $(pwd)/ml/python/models:/app/models ucl-ml-server
```

### Environment Variables

Configure these in `.env`:

```bash
# ML Server Configuration
ML_SERVER_URL=http://localhost:8000
ML_MODEL_PATH=ml/python/models/trained

# Model Training
ML_TRAINING_ENABLED=true
ML_RETRAIN_FREQUENCY=weekly

# Feature Flags
USE_ML_PREDICTIONS=true  # Toggle ML vs fallback predictions
ENABLE_SHAP_EXPLANATIONS=true
```

## Troubleshooting

### ML Server Not Starting

**Issue:** `ModuleNotFoundError: No module named 'xgboost'`

**Solution:**
```bash
cd ml/python
pip install -r requirements.txt
```

### Models Not Loading

**Issue:** `FileNotFoundError: models/trained/match_outcome_model.pkl`

**Solution:**
```bash
cd ml/python
python train.py --model all
```

### Integration Errors

**Issue:** Node.js server shows `⚠️  Python ML server not available`

**Solution:**
1. Check if FastAPI server is running: `curl http://localhost:8000/health`
2. Verify `ML_SERVER_URL` environment variable
3. Check FastAPI server logs for errors
4. Test ML bridge manually:
```typescript
import { mlBridge } from './server/ml/pythonBridge';
await mlBridge.checkAvailability();
```

### Low Prediction Accuracy

**Issue:** Model predictions seem inaccurate

**Solution:**
1. Retrain with more data: `python train.py --samples 5000`
2. Use real historical data instead of synthetic
3. Check feature engineering logic
4. Validate feature importance
5. Monitor model performance metrics

## Next Steps

1. **Integrate real data** - Replace synthetic training data with historical UCL matches
2. **Add Redis caching** - Cache predictions for frequently requested matches
3. **Set up CI/CD** - Automate model training and deployment
4. **Implement A/B testing** - Compare ML predictions vs fallback model
5. **Add monitoring** - Track prediction accuracy in production
6. **Optimize performance** - Profile and optimize slow prediction paths

## References

- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [SHAP Documentation](https://shap.readthedocs.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Football Data API](https://www.football-data.org/)
