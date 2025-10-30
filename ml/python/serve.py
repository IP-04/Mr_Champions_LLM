"""
FastAPI ML Server for UCL Match Predictions
Serves XGBoost models and SHAP explanations
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.match_predictor import MatchOutcomePredictor, ExpectedGoalsPredictor
from models.player_predictor import PlayerPerformancePredictor
from explainability.explainer import MatchExplainer

# Initialize FastAPI app
app = FastAPI(
    title="UCL ML Prediction API",
    description="Machine Learning API for UEFA Champions League Match Predictions",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models at startup
MODEL_PATH = os.getenv('MODEL_PATH', './models/trained/')
outcome_model = MatchOutcomePredictor(
    model_path=os.path.join(MODEL_PATH, 'match_outcome_model.pkl')
)
xg_model_home = ExpectedGoalsPredictor(
    model_path=os.path.join(MODEL_PATH, 'xg_home_model.pkl')
)
xg_model_away = ExpectedGoalsPredictor(
    model_path=os.path.join(MODEL_PATH, 'xg_away_model.pkl')
)
explainer = MatchExplainer(outcome_model)

# Load player prediction models
player_predictor = PlayerPerformancePredictor(model_path=MODEL_PATH)

# Pydantic models for request/response
class MatchFeatures(BaseModel):
    home_elo: float = Field(..., description="Home team ELO rating")
    away_elo: float = Field(..., description="Away team ELO rating")
    elo_diff: float = Field(..., description="ELO difference")
    home_form_last5: float = Field(..., description="Home team form (last 5 matches)")
    away_form_last5: float = Field(..., description="Away team form (last 5 matches)")
    home_goals_last5: int = Field(..., description="Home team goals scored (last 5)")
    away_goals_last5: int = Field(..., description="Away team goals scored (last 5)")
    home_xg_last5: float = Field(..., description="Home team xG (last 5)")
    away_xg_last5: float = Field(..., description="Away team xG (last 5)")
    h2h_home_wins: int = Field(..., description="Head-to-head home wins")
    h2h_draws: int = Field(..., description="Head-to-head draws")
    h2h_away_wins: int = Field(..., description="Head-to-head away wins")
    home_possession_avg: float = Field(..., description="Home possession average")
    away_possession_avg: float = Field(..., description="Away possession average")
    venue_advantage: float = Field(..., description="Venue advantage factor")
    stage_importance: float = Field(..., description="Tournament stage importance")
    home_rest_days: int = Field(..., description="Home team rest days")
    away_rest_days: int = Field(..., description="Away team rest days")
    # New anti-bias features
    elo_gap_magnitude: float = Field(..., description="Absolute ELO difference")
    underdog_factor: int = Field(..., description="1 if away team is stronger, else 0")
    quality_tier_home: int = Field(..., description="Home team quality tier (1=elite, 2=strong, 3=mid)")
    quality_tier_away: int = Field(..., description="Away team quality tier (1=elite, 2=strong, 3=mid)")
    strength_adjusted_venue: float = Field(..., description="Venue advantage adjusted by strength gap")

class MatchPredictionRequest(BaseModel):
    home_team: str = Field(..., description="Home team name")
    away_team: str = Field(..., description="Away team name")
    features: MatchFeatures

class MatchPredictionResponse(BaseModel):
    home_win_prob: float
    draw_prob: float
    away_win_prob: float
    home_xg: float
    away_xg: float
    confidence: float

class ExplanationResponse(BaseModel):
    prediction: MatchPredictionResponse
    feature_importance: List[Dict[str, float]]
    shap_values: Dict[str, float]
    top_factors: Dict[str, List[Dict]]

class FeatureImportance(BaseModel):
    feature: str
    importance: float

class PlayerFeatures(BaseModel):
    overall_rating: float
    pace: float
    shooting: float
    passing: float
    dribbling: float
    defending: float
    physical: float
    is_forward: int
    is_midfielder: int
    is_defender: int
    is_goalkeeper: int
    team_elo: float
    team_form_points: float
    team_avg_goals_scored: float
    team_avg_goals_conceded: float
    opponent_elo: float
    opponent_def_rating: float
    is_home: int
    elo_differential: float
    player_goals_last_5: float
    player_assists_last_5: float
    player_minutes_last_5: float
    player_avg_rating_last_5: float

class PlayerPredictionRequest(BaseModel):
    player_name: str
    position: str  # FWD, MID, DEF, GK
    features: PlayerFeatures

class PlayerPredictionResponse(BaseModel):
    player_name: str
    position: str
    predictions: Dict[str, float]  # stat_name -> expected_value
    confidence: float

class HealthResponse(BaseModel):
    status: str
    models_loaded: Dict[str, bool]
    version: str

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "UCL ML Prediction API",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        models_loaded={
            "match_outcome": outcome_model.model is not None,
            "xg_home": xg_model_home.model is not None,
            "xg_away": xg_model_away.model is not None,
            "player_predictor": player_predictor is not None
        },
        version="1.0.0"
    )

@app.post("/predict/match", response_model=MatchPredictionResponse)
async def predict_match(request: MatchPredictionRequest):
    """
    Predict match outcome probabilities and expected goals
    """
    try:
        print(f"\n[ML Server] Received prediction request:")
        print(f"  Home: {request.home_team}")
        print(f"  Away: {request.away_team}")
        print(f"  Features: {request.features.dict()}")
        
        # Get match outcome probabilities
        features_dict = request.features.dict()
        outcome_probs = outcome_model.predict_proba(features_dict)
        
        print(f"[ML Server] Outcome probabilities: {outcome_probs}")
        
        # Predict expected goals for home and away
        # xG models use first 12 features: elo ratings, form, goals, xG, and H2H stats
        home_xg_features = {
            'home_elo': features_dict['home_elo'],
            'away_elo': features_dict['away_elo'],
            'elo_diff': features_dict['elo_diff'],
            'home_form_last5': features_dict['home_form_last5'],
            'away_form_last5': features_dict['away_form_last5'],
            'home_goals_last5': features_dict['home_goals_last5'],
            'away_goals_last5': features_dict['away_goals_last5'],
            'home_xg_last5': features_dict['home_xg_last5'],
            'away_xg_last5': features_dict['away_xg_last5'],
            'h2h_home_wins': features_dict['h2h_home_wins'],
            'h2h_draws': features_dict['h2h_draws'],
            'h2h_away_wins': features_dict['h2h_away_wins']
        }
        
        away_xg_features = {
            'home_elo': features_dict['home_elo'],
            'away_elo': features_dict['away_elo'],
            'elo_diff': features_dict['elo_diff'],
            'home_form_last5': features_dict['home_form_last5'],
            'away_form_last5': features_dict['away_form_last5'],
            'home_goals_last5': features_dict['home_goals_last5'],
            'away_goals_last5': features_dict['away_goals_last5'],
            'home_xg_last5': features_dict['home_xg_last5'],
            'away_xg_last5': features_dict['away_xg_last5'],
            'h2h_home_wins': features_dict['h2h_home_wins'],
            'h2h_draws': features_dict['h2h_draws'],
            'h2h_away_wins': features_dict['h2h_away_wins']
        }
        
        home_xg = xg_model_home.predict(home_xg_features)
        away_xg = xg_model_away.predict(away_xg_features)
        
        print(f"[ML Server] xG predictions - Home: {home_xg}, Away: {away_xg}")
        
        response = MatchPredictionResponse(
            home_win_prob=outcome_probs['home_win_prob'],
            draw_prob=outcome_probs['draw_prob'],
            away_win_prob=outcome_probs['away_win_prob'],
            home_xg=home_xg,
            away_xg=away_xg,
            confidence=outcome_probs['confidence']
        )
        
        print(f"[ML Server] ✅ Sending response: {response}")
        return response
    
    except Exception as e:
        print(f"[ML Server] ❌ Error during prediction: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/explain/match", response_model=ExplanationResponse)
async def explain_match(request: MatchPredictionRequest):
    """
    Get SHAP explanation for match prediction
    """
    try:
        # Get prediction
        features_dict = request.features.dict()
        prediction = outcome_model.predict_proba(features_dict)
        
        # Get feature importance
        feature_importance = outcome_model.get_feature_importance()
        
        # Get SHAP values
        shap_values = explainer.explain_prediction(features_dict)
        
        # Identify top positive and negative factors
        sorted_shap = sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
        top_positive = [
            {'feature': k, 'impact': v}
            for k, v in sorted_shap if v > 0
        ][:5]
        top_negative = [
            {'feature': k, 'impact': v}
            for k, v in sorted_shap if v < 0
        ][:5]
        
        # Calculate xG
        home_xg_features = {
            'team_elo': features_dict['home_elo'],
            'opponent_elo': features_dict['away_elo'],
            'team_goals_last5': features_dict['home_goals_last5'],
            'team_xg_last5': features_dict['home_xg_last5'],
            'opponent_goals_conceded_last5': features_dict['away_goals_last5'],
            'opponent_xga_last5': features_dict['away_xg_last5'],
            'team_shots_last5': 15,
            'team_shots_on_target_last5': 8,
            'possession_avg': features_dict['home_possession_avg'],
            'venue_advantage': features_dict['venue_advantage']
        }
        
        away_xg_features = {
            'team_elo': features_dict['away_elo'],
            'opponent_elo': features_dict['home_elo'],
            'team_goals_last5': features_dict['away_goals_last5'],
            'team_xg_last5': features_dict['away_xg_last5'],
            'opponent_goals_conceded_last5': features_dict['home_goals_last5'],
            'opponent_xga_last5': features_dict['home_xg_last5'],
            'team_shots_last5': 12,
            'team_shots_on_target_last5': 6,
            'possession_avg': features_dict['away_possession_avg'],
            'venue_advantage': -features_dict['venue_advantage']
        }
        
        home_xg = xg_model_home.predict(home_xg_features)
        away_xg = xg_model_away.predict(away_xg_features)
        
        return ExplanationResponse(
            prediction=MatchPredictionResponse(
                home_win_prob=prediction['home_win_prob'],
                draw_prob=prediction['draw_prob'],
                away_win_prob=prediction['away_win_prob'],
                home_xg=home_xg,
                away_xg=away_xg,
                confidence=prediction['confidence']
            ),
            feature_importance=feature_importance,
            shap_values=shap_values,
            top_factors={
                'positive': top_positive,
                'negative': top_negative
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation error: {str(e)}")

@app.get("/features/importance", response_model=List[FeatureImportance])
async def get_feature_importance():
    """Get global feature importance from trained model"""
    try:
        importance = outcome_model.get_feature_importance()
        return [FeatureImportance(**item) for item in importance]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting feature importance: {str(e)}")

@app.post("/predict/player", response_model=PlayerPredictionResponse)
async def predict_player(request: PlayerPredictionRequest):
    """
    Predict player performance statistics
    """
    try:
        print(f"\n[ML Server] Received player prediction request:")
        print(f"  Player: {request.player_name}")
        print(f"  Position: {request.position}")
        
        features_dict = request.features.dict()
        predictions = player_predictor.predict(request.position, features_dict)
        
        print(f"[ML Server] Player predictions: {predictions}")
        
        response = PlayerPredictionResponse(
            player_name=request.player_name,
            position=request.position,
            predictions=predictions,
            confidence=0.75  # Can be calculated from model uncertainty
        )
        
        print(f"[ML Server] ✅ Sending player response: {response}")
        return response
    
    except Exception as e:
        print(f"[ML Server] ❌ Error during player prediction: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Player prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "serve:app",
        host="127.0.0.1",  # Use IPv4 localhost for Windows compatibility
        port=int(os.getenv("PORT", "8000")),
        reload=True
    )
