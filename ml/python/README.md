# UCL ML Engine - Python Machine Learning Backend

## Overview

This directory contains the Python-based machine learning infrastructure for the UEFA Champions League Performance Predictor platform. It implements XGBoost models for match outcome prediction, player performance forecasting, and SHAP-based explainability.

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd ml/python
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```powershell
.\venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

Or install in development mode:
```bash
pip install -e .
```

### 4. Verify Installation

```bash
python -c "import xgboost; import shap; import fastapi; print('✅ ML libraries installed successfully')"
```

## Directory Structure

```
ml/python/
├── models/           # ML model implementations
│   ├── match_predictor.py      # XGBoost match outcome model
│   ├── player_predictor.py     # Player performance models
│   └── trained/                # Saved model files (.pkl)
├── explainability/   # SHAP and feature importance
│   └── explainer.py
├── utils/            # Helper functions
│   ├── feature_engineering.py
│   └── data_loader.py
├── data/             # Training data cache
├── serve.py          # FastAPI server
├── train.py          # Model training scripts
├── requirements.txt
├── setup.py
└── README.md
```

## Running the ML Server

```bash
# Start FastAPI server on port 8000
uvicorn serve:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

- `POST /predict/match` - Match outcome prediction
- `POST /predict/player` - Player performance prediction
- `POST /explain/match` - SHAP explanation for match prediction
- `GET /health` - Health check

## Training Models

```bash
python train.py --model match --epochs 100
python train.py --model player --position FWD
```

## Environment Variables

Create a `.env` file:
```
DATABASE_URL=postgresql://user:pass@host:port/db
MODEL_PATH=./models/trained/
LOG_LEVEL=INFO
```
