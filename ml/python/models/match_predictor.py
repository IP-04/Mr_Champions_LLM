"""
Match Outcome Prediction using XGBoost
Predicts Win/Draw/Loss probabilities + Expected Goals
"""

import xgboost as xgb
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, accuracy_score, mean_squared_error, r2_score
import joblib
import json
import os
from typing import Dict, List, Tuple, Optional

class MatchOutcomePredictor:
    """
    Multi-class classifier for match outcomes
    Classes: 0=Home Win, 1=Draw, 2=Away Win
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'home_elo', 'away_elo', 'elo_diff',
            'home_form_last5', 'away_form_last5',
            'home_goals_last5', 'away_goals_last5',
            'home_xg_last5', 'away_xg_last5',
            'h2h_home_wins', 'h2h_draws', 'h2h_away_wins',
            'home_possession_avg', 'away_possession_avg',
            'venue_advantage', 'stage_importance',
            'home_rest_days', 'away_rest_days',
            # New features to reduce home bias
            'elo_gap_magnitude',          # abs(elo_diff) - nonlinear strength gap
            'underdog_factor',            # 1 if away_elo > home_elo else 0
            'quality_tier_home',          # 1=elite(>1850), 2=strong(1750-1850), 3=mid(<1750)
            'quality_tier_away',
            'strength_adjusted_venue'     # venue_advantage * (1 - abs(elo_diff)/200)
        ]
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            # UPDATED: Better params for 616 samples to reduce overfitting
            self.model = xgb.XGBClassifier(
                n_estimators=80,      # Reduced from 100
                max_depth=3,          # Reduced from 4 - prevents memorization
                learning_rate=0.05,   # Reduced from 0.08 - slower, more careful learning
                subsample=0.7,        # Reduced from 0.8 - more regularization
                colsample_bytree=0.7, # Reduced from 0.8
                min_child_weight=5,   # INCREASED from 2 - requires more samples per leaf
                gamma=0.5,            # INCREASED from 0.3 - harder to make splits
                reg_alpha=0.1,        # INCREASED L1 regularization
                reg_lambda=1.0,       # INCREASED L2 regularization
                objective='multi:softprob',
                num_class=3,
                eval_metric='mlogloss',
                random_state=42,
                use_label_encoder=False
            )
    
    def prepare_features(self, match_data: Dict) -> np.ndarray:
        """Convert match data dict to feature array"""
        features = []
        for feature in self.feature_names:
            features.append(match_data.get(feature, 0))
        return np.array(features).reshape(1, -1)
    
    def train(self, X: np.ndarray, y: np.ndarray, validation_split: float = 0.2) -> Dict:
        """
        Train the model with cross-validation
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y: Labels (n_samples,) - 0/1/2 for Home/Draw/Away
            validation_split: Fraction for validation
        
        Returns:
            dict: Training metrics
        """
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=validation_split, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        
        # Train with early stopping
        self.model.fit(
            X_train_scaled, y_train,
            eval_set=[(X_val_scaled, y_val)],
            verbose=False
        )
        
        # Evaluate
        train_pred = self.model.predict(X_train_scaled)
        val_pred = self.model.predict(X_val_scaled)
        
        train_proba = self.model.predict_proba(X_train_scaled)
        val_proba = self.model.predict_proba(X_val_scaled)
        
        metrics = {
            'train_accuracy': float(accuracy_score(y_train, train_pred)),
            'val_accuracy': float(accuracy_score(y_val, val_pred)),
            'train_logloss': float(log_loss(y_train, train_proba)),
            'val_logloss': float(log_loss(y_val, val_proba)),
            'best_iteration': int(self.model.best_iteration) if hasattr(self.model, 'best_iteration') else 0,
            'n_samples_train': len(X_train),
            'n_samples_val': len(X_val)
        }
        
        return metrics
    
    def predict_proba(self, match_data: Dict) -> Dict:
        """
        Predict match outcome probabilities
        
        Args:
            match_data: dict with feature values
        
        Returns:
            dict: {'home_win_prob': prob, 'draw_prob': prob, 'away_win_prob': prob}
        """
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        X = self.prepare_features(match_data)
        X_scaled = self.scaler.transform(X)
        
        proba = self.model.predict_proba(X_scaled)[0]
        
        # Light smoothing to avoid only extreme predictions (90%+)
        # Mostly trust model predictions with minimal baseline mixing
        alpha = 0.92  # Weight for model predictions (92% model + 8% baseline)
        baseline = np.array([0.333, 0.333, 0.334])  # Neutral baseline - no home advantage bias
        
        smoothed_proba = alpha * proba + (1 - alpha) * baseline
        
        # Normalize to ensure probabilities sum to 100%
        smoothed_proba = smoothed_proba / smoothed_proba.sum()
        
        return {
            'home_win_prob': float(smoothed_proba[0] * 100),
            'draw_prob': float(smoothed_proba[1] * 100),
            'away_win_prob': float(smoothed_proba[2] * 100),
            'confidence': float(max(smoothed_proba) * 100)
        }
    
    def get_feature_importance(self) -> List[Dict]:
        """Get feature importance scores"""
        if self.model is None:
            raise ValueError("Model not trained")
        
        importance = self.model.feature_importances_
        return [
            {'feature': name, 'importance': float(score)}
            for name, score in zip(self.feature_names, importance)
        ]
    
    def save_model(self, path: str):
        """Save model and scaler"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }, path)
        print(f"✅ Model saved to {path}")
    
    def load_model(self, path: str):
        """Load model and scaler"""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']
        print(f"✅ Model loaded from {path}")


class ExpectedGoalsPredictor:
    """
    XGBoost regressor for expected goals (xG)
    Separate models for home and away teams
    """
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.scaler = StandardScaler()
        # These are the first 12 features from the 18-feature training set
        self.feature_names = [
            'home_elo', 'away_elo', 'elo_diff',
            'home_form_last5', 'away_form_last5',
            'home_goals_last5', 'away_goals_last5',
            'home_xg_last5', 'away_xg_last5',
            'h2h_home_wins', 'h2h_draws', 'h2h_away_wins'
        ]
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            # Reduced complexity for realistic xG predictions
            self.model = xgb.XGBRegressor(
                n_estimators=50,      # Reduced from 150
                max_depth=3,          # Reduced from 5
                learning_rate=0.05,   # Reduced from 0.08
                subsample=0.7,        # Reduced from 0.85
                colsample_bytree=0.7, # Reduced from 0.8
                min_child_weight=2,   # Added regularization
                gamma=0.3,            # Added regularization
                reg_lambda=2.0,       # Increased L2 regularization
                reg_alpha=1.0,        # Increased L1 regularization
                random_state=42
            )
    
    def prepare_features(self, match_data: Dict) -> np.ndarray:
        """Convert match data dict to feature array"""
        features = []
        for feature in self.feature_names:
            features.append(match_data.get(feature, 0))
        return np.array(features).reshape(1, -1)
    
    def train(self, X: np.ndarray, y: np.ndarray) -> Dict:
        """Train xG prediction model"""
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        
        # Calculate metrics
        predictions = self.model.predict(X_scaled)
        rmse = np.sqrt(mean_squared_error(y, predictions))
        mae = np.mean(np.abs(y - predictions))
        r2 = r2_score(y, predictions)
        
        return {
            'rmse': float(rmse),
            'mae': float(mae),
            'r2': float(r2)
        }
    
    def predict(self, match_data: Dict) -> float:
        """Predict expected goals with realistic bounds"""
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        
        X = self.prepare_features(match_data)
        X_scaled = self.scaler.transform(X)
        xg_raw = self.model.predict(X_scaled)[0]
        
        # Apply smoothing toward realistic mean (1.5 goals)
        # Mix prediction with baseline to avoid extremes
        baseline_xg = 1.5
        alpha = 0.7  # 70% model, 30% baseline
        xg_smoothed = alpha * xg_raw + (1 - alpha) * baseline_xg
        
        # Clamp to realistic range for Champions League
        return float(max(0.5, min(3.5, xg_smoothed)))
    
    def save_model(self, path: str):
        """Save model and scaler"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }, path)
        print(f"✅ xG Model saved to {path}")
    
    def load_model(self, path: str):
        """Load model and scaler"""
        data = joblib.load(path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']
        print(f"✅ xG Model loaded from {path}")


# Example usage and initial training
if __name__ == "__main__":
    # Generate sample training data for initial model
    np.random.seed(42)
    n_samples = 1000
    
    # Mock features (replace with real data in production)
    X = np.random.randn(n_samples, 17)
    
    # Mock labels (simulate realistic distribution)
    y = np.random.choice([0, 1, 2], size=n_samples, p=[0.45, 0.27, 0.28])
    
    # Train model
    print("Training Match Outcome Predictor...")
    predictor = MatchOutcomePredictor()
    metrics = predictor.train(X, y)
    
    print("\nTraining Metrics:")
    print(json.dumps(metrics, indent=2))
    
    # Save model
    predictor.save_model('models/trained/match_outcome_model.pkl')
    
    # Test prediction
    test_match = {
        'home_elo': 1850, 'away_elo': 1780, 'elo_diff': 70,
        'home_form_last5': 2.2, 'away_form_last5': 1.8,
        'home_goals_last5': 8, 'away_goals_last5': 6,
        'home_xg_last5': 7.5, 'away_xg_last5': 5.8,
        'h2h_home_wins': 2, 'h2h_draws': 1, 'h2h_away_wins': 0,
        'home_possession_avg': 58, 'away_possession_avg': 52,
        'venue_advantage': 1, 'stage_importance': 8,
        'home_rest_days': 4, 'away_rest_days': 3
    }
    
    result = predictor.predict_proba(test_match)
    print("\nSample Prediction:")
    print(json.dumps(result, indent=2))
    
    # Feature importance
    importance = predictor.get_feature_importance()
    print("\nTop 5 Features:")
    sorted_importance = sorted(importance, key=lambda x: x['importance'], reverse=True)[:5]
    for item in sorted_importance:
        print(f"  {item['feature']}: {item['importance']:.4f}")
