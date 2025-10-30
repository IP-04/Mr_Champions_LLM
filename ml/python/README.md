# UCL ML Engine - Python Machine Learning Backend

## 🚀 Quick Start Guide

### Option 1: Automated Setup (Recommended)

```powershell
# Navigate to this directory
cd c:\Users\isaia\Desktop\Mr_Champions_LLM\ml\python

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run the quickstart script (trains models and starts server)
python quickstart.py
```

### Option 2: Step-by-Step Setup

#### 1️⃣ Activate Virtual Environment

```powershell
cd c:\Users\isaia\Desktop\Mr_Champions_LLM\ml\python
.\venv\Scripts\Activate.ps1
```

#### 2️⃣ Train ML Models

```powershell
# Train all models with 1000 samples
python train.py --model all --samples 1000

# Or train specific models
python train.py --model match  # Just match outcome
python train.py --model xg     # Just expected goals
```

**Expected Output:**
```
🚀 UCL ML Model Training Pipeline
📅 Started at: 2025-10-29 10:30:00
📦 Samples: 1000

Training Match Outcome Predictor...
✅ Model saved to models/trained/match_outcome_model.pkl

Training Expected Goals Predictors...
✅ Models saved!
```

#### 3️⃣ Start ML API Server

```powershell
uvicorn serve:app --host 0.0.0.0 --port 8000 --reload
```

**Server URLs:**
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs` ← Interactive API testing
- Health: `http://localhost:8000/health`

---

## 📊 What's Included

### Trained Models

| Model | Purpose | Output |
|-------|---------|--------|
| `match_outcome_model.pkl` | Win/Draw/Loss prediction | 3 probabilities (%) |
| `xg_home_model.pkl` | Home team expected goals | Float (0.3-4.0) |
| `xg_away_model.pkl` | Away team expected goals | Float (0.3-4.0) |

### API Endpoints

#### 1. **Match Prediction** - `POST /predict/match`

**Request:**
```json
{
  "home_team": "Real Madrid",
  "away_team": "Manchester City",
  "features": {
    "home_elo": 1850,
    "away_elo": 1820,
    "elo_diff": 30,
    "home_form_last5": 2.4,
    "away_form_last5": 2.2,
    "home_goals_last5": 8,
    "away_goals_last5": 7,
    "home_xg_last5": 7.5,
    "away_xg_last5": 7.2,
    "h2h_home_wins": 2,
    "h2h_draws": 1,
    "h2h_away_wins": 1,
    "home_possession_avg": 58,
    "away_possession_avg": 56,
    "venue_advantage": 1,
    "stage_importance": 9,
    "home_rest_days": 4,
    "away_rest_days": 3
  }
}
```

**Response:**
```json
{
  "home_win_prob": 43.8,
  "draw_prob": 27.5,
  "away_win_prob": 28.7,
  "home_xg": 1.92,
  "away_xg": 1.75,
  "confidence": 43.8
}
```

#### 2. **SHAP Explanation** - `POST /explain/match`

Same request format, returns feature importance and SHAP values.

#### 3. **Health Check** - `GET /health`

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

---

## 🧪 Testing the Server

### Using PowerShell

```powershell
# Test health check
Invoke-RestMethod -Uri "http://localhost:8000/health"

# Make a prediction
$body = @{
  home_team = "Real Madrid"
  away_team = "Barcelona"
  features = @{
    home_elo = 1850
    away_elo = 1820
    elo_diff = 30
    home_form_last5 = 2.4
    away_form_last5 = 2.0
    home_goals_last5 = 8
    away_goals_last5 = 7
    home_xg_last5 = 7.5
    away_xg_last5 = 7.0
    h2h_home_wins = 3
    h2h_draws = 2
    h2h_away_wins = 1
    home_possession_avg = 58
    away_possession_avg = 52
    venue_advantage = 1
    stage_importance = 8
    home_rest_days = 4
    away_rest_days = 3
  }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/predict/match" -Method POST -Body $body -ContentType "application/json"
```

### Using Jupyter Notebook

Open `ML_Training_Guide.ipynb` for an interactive walkthrough!

---

## 📁 Directory Structure

```
ml/python/
├── models/
│   ├── match_predictor.py      # XGBoost models
│   └── trained/                # Saved .pkl files
├── explainability/
│   └── explainer.py            # SHAP explanations
├── utils/
│   └── feature_engineering.py  # ELO, form calculations
├── serve.py                    # FastAPI server
├── train.py                    # Training pipeline
├── quickstart.py              # One-command setup
├── ML_Training_Guide.ipynb    # Interactive tutorial
├── requirements.txt
└── README.md
```

---

## 🔧 Advanced Usage

### Train with More Samples

```powershell
python train.py --model all --samples 5000
```

### Custom Server Port

```powershell
uvicorn serve:app --port 8080
```

### Training Only (No Server)

```powershell
python quickstart.py --train-only
```

### Server Only (Models Already Trained)

```powershell
python quickstart.py --serve-only
```

---

## ⚙️ How It Works

### 1. **Feature Engineering**

18 features per match:
- **Team Strength**: ELO ratings, ELO difference
- **Recent Form**: Last 5 matches (points, goals, xG)
- **Head-to-Head**: Historical matchups
- **Match Context**: Possession, venue, stage importance, rest days

### 2. **Model Architecture**

- **Algorithm**: XGBoost (Gradient Boosting)
- **Match Outcome**: Multi-class classifier (3 classes)
- **Expected Goals**: Regression (separate models for home/away)
- **Explainability**: SHAP TreeExplainer

### 3. **Training Process**

1. Generate/load training data
2. Feature scaling (StandardScaler)
3. Train XGBoost with early stopping
4. Cross-validation
5. Save models to `.pkl` files

### 4. **Prediction Process**

1. API receives match features
2. Load trained models from disk
3. Scale input features
4. XGBoost inference
5. Calculate SHAP values (optional)
6. Return probabilities + xG

---

## 🐛 Troubleshooting

### Models Not Found

```
❌ ERROR: Missing trained models!
```

**Solution:** Run training first
```powershell
python train.py --model all
```

### Import Errors

```
ModuleNotFoundError: No module named 'xgboost'
```

**Solution:** Activate venv and reinstall
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Server Won't Start

```
❌ Could not connect to ML server
```

**Solution:** Check if port 8000 is available
```powershell
netstat -ano | findstr :8000
# Kill the process if needed
```

---

## 📚 Next Steps

1. ✅ **You are here** - Models trained and server running
2. 🔗 **Integration** - Connect TypeScript backend to Python API
3. 📊 **Real Data** - Replace synthetic data with actual UCL matches
4. 🎯 **Feature Store** - Auto-extract features from database
5. 🔄 **Auto-Retrain** - Scheduled model updates with new data

---

## 🤝 Need Help?

- Check the Jupyter notebook: `ML_Training_Guide.ipynb`
- View API docs: `http://localhost:8000/docs`
- Read the main documentation: `../../ML_IMPLEMENTATION_SUMMARY.md`
