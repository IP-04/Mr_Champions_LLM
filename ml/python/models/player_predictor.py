"""
Player Performance Predictor
Predicts individual player statistics using XGBoost regressors
"""

import os
import json
import xgboost as xgb
import numpy as np
from pathlib import Path
from typing import Dict, List


class PlayerPerformancePredictor:
    """
    Predicts player performance statistics (goals, assists, shots, tackles, etc.)
    Uses separate models for each position type (FWD, MID, DEF, GK)
    """
    
    def __init__(self, model_path: str = './models/trained/'):
        """
        Initialize player performance predictor
        
        Args:
            model_path: Path to directory containing trained models
        """
        self.model_path = Path(model_path)
        self.models = {}
        self.feature_config = None
        
        # Load feature configuration
        config_path = self.model_path / 'player_features.json'
        if config_path.exists():
            with open(config_path, 'r') as f:
                self.feature_config = json.load(f)
            print(f"[PlayerPredictor] Loaded feature config: {config_path}")
        
        # Load all trained models
        self._load_models()
    
    def _load_models(self):
        """Load all position-specific models"""
        model_files = list(self.model_path.glob('player_*.json'))
        
        for model_file in model_files:
            try:
                model_name = model_file.stem.replace('player_', '')
                model = xgb.XGBRegressor()
                model.load_model(str(model_file))
                self.models[model_name] = model
                print(f"[PlayerPredictor] Loaded model: {model_name}")
            except Exception as e:
                print(f"[PlayerPredictor] Failed to load {model_file.name}: {e}")
        
        print(f"[PlayerPredictor] Total models loaded: {len(self.models)}")
    
    def predict(self, position: str, features: Dict) -> Dict[str, float]:
        """
        Predict player performance statistics
        
        Args:
            position: Player position ('FWD', 'MID', 'DEF', 'GK')
            features: Dictionary of feature values
        
        Returns:
            Dictionary of predicted statistics
        """
        position_lower = position.lower()
        predictions = {}
        
        # Convert features dict to numpy array in correct order
        if self.feature_config:
            feature_names = self.feature_config['feature_names']
            X = np.array([[features.get(fname, 0) for fname in feature_names]])
        else:
            # Fallback: use features in dict order
            X = np.array([list(features.values())])
        
        # Get target stats for this position
        if position == 'FWD':
            targets = self.feature_config.get('forward_targets', ['goals', 'shots', 'assists', 'key_passes'])
        elif position == 'MID':
            targets = self.feature_config.get('midfielder_targets', ['assists', 'key_passes', 'goals', 'tackles', 'interceptions'])
        elif position == 'DEF':
            targets = self.feature_config.get('defender_targets', ['tackles', 'interceptions', 'clearances', 'blocks'])
        elif position == 'GK':
            targets = self.feature_config.get('goalkeeper_targets', ['saves', 'goals_conceded', 'clean_sheet'])
        else:
            print(f"[PlayerPredictor] Warning: Unknown position {position}, defaulting to MID")
            targets = ['assists', 'key_passes', 'goals']
        
        # Predict each stat
        for target in targets:
            model_key = f'{position_lower}_{target}'
            
            if model_key in self.models:
                try:
                    pred = self.models[model_key].predict(X)[0]
                    # Ensure non-negative predictions
                    predictions[target] = max(0.0, float(pred))
                except Exception as e:
                    print(f"[PlayerPredictor] Error predicting {model_key}: {e}")
                    predictions[target] = 0.0
            else:
                # Model not found, use simple heuristic
                predictions[target] = self._fallback_prediction(position, target, features)
        
        return predictions
    
    def _fallback_prediction(self, position: str, stat: str, features: Dict) -> float:
        """
        Fallback prediction when model is not available
        Uses simple heuristics based on overall rating
        """
        overall = features.get('overall_rating', 75)
        
        # Position-based stat expectations
        if position == 'FWD':
            if stat == 'goals':
                return max(0.0, (overall - 50) / 100)
            elif stat == 'shots':
                return max(0.0, (overall - 45) / 50 + 1.0)
            elif stat == 'assists':
                return max(0.0, (overall - 60) / 120)
            elif stat == 'key_passes':
                return max(0.0, (overall - 55) / 100 + 0.5)
        
        elif position == 'MID':
            if stat == 'goals':
                return max(0.0, (overall - 65) / 150)
            elif stat == 'assists':
                return max(0.0, (overall - 55) / 100)
            elif stat == 'key_passes':
                return max(0.0, (overall - 50) / 80 + 1.0)
            elif stat == 'tackles':
                return max(0.0, (overall - 60) / 80 + 1.0)
            elif stat == 'interceptions':
                return max(0.0, (overall - 65) / 100 + 0.5)
        
        elif position == 'DEF':
            if stat == 'tackles':
                return max(0.0, (overall - 55) / 60 + 2.0)
            elif stat == 'interceptions':
                return max(0.0, (overall - 60) / 80 + 1.0)
            elif stat == 'clearances':
                return max(0.0, (overall - 50) / 50 + 2.0)
            elif stat == 'blocks':
                return max(0.0, (overall - 65) / 100 + 0.5)
        
        elif position == 'GK':
            if stat == 'saves':
                return max(0.0, (overall - 60) / 20 + 2.0)
            elif stat == 'goals_conceded':
                return max(0.0, 2.0 - (overall - 70) / 30)
            elif stat == 'clean_sheet':
                return max(0.0, min(1.0, (overall - 65) / 50 + 0.2))
        
        return 0.0
    
    def get_available_models(self) -> List[str]:
        """Return list of available model names"""
        return list(self.models.keys())


# Test the predictor
if __name__ == "__main__":
    # Test with dummy data
    predictor = PlayerPerformancePredictor()
    
    test_features = {
        'overall_rating': 88,
        'pace': 85,
        'shooting': 90,
        'passing': 80,
        'dribbling': 87,
        'defending': 35,
        'physical': 75,
        'is_forward': 1,
        'is_midfielder': 0,
        'is_defender': 0,
        'is_goalkeeper': 0,
        'team_elo': 1950,
        'team_form_points': 12,
        'team_avg_goals_scored': 2.5,
        'team_avg_goals_conceded': 0.8,
        'opponent_elo': 1850,
        'opponent_def_rating': 82,
        'is_home': 1,
        'elo_differential': 100,
        'player_goals_last_5': 3,
        'player_assists_last_5': 2,
        'player_minutes_last_5': 425,
        'player_avg_rating_last_5': 7.5,
    }
    
    predictions = predictor.predict('FWD', test_features)
    print(f"\n🎯 Test Predictions for Elite Forward:")
    for stat, value in predictions.items():
        print(f"   {stat}: {value:.2f}")
