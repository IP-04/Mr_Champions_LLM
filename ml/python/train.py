"""
Model Training Script
Train XGBoost models on historical UCL data
"""

import argparse
import numpy as np
import json
import os
from datetime import datetime

from models.match_predictor import MatchOutcomePredictor, ExpectedGoalsPredictor
from utils.feature_engineering import ELOSystem, FormCalculator

def generate_synthetic_training_data(n_samples: int = 1000):
    """
    Generate synthetic training data for initial model
    Replace with real data from Football Data API in production
    
    Args:
        n_samples: Number of training samples
    
    Returns:
        Tuple of (X, y_outcome, y_xg_home, y_xg_away)
    """
    np.random.seed(42)
    
    # Generate feature matrix
    X = np.random.randn(n_samples, 17)
    
    # Normalize some features to realistic ranges
    X[:, 0] = 1500 + X[:, 0] * 200  # home_elo (1300-1700)
    X[:, 1] = 1500 + X[:, 1] * 200  # away_elo
    X[:, 2] = X[:, 0] - X[:, 1]     # elo_diff
    X[:, 3] = np.clip(X[:, 3] * 0.5 + 1.5, 0, 3)  # home_form_last5 (0-3 points)
    X[:, 4] = np.clip(X[:, 4] * 0.5 + 1.5, 0, 3)  # away_form_last5
    X[:, 5] = np.clip(X[:, 5] * 2 + 6, 0, 15)     # home_goals_last5 (0-15)
    X[:, 6] = np.clip(X[:, 6] * 2 + 6, 0, 15)     # away_goals_last5
    X[:, 7] = np.clip(X[:, 7] * 2 + 6, 0, 12)     # home_xg_last5
    X[:, 8] = np.clip(X[:, 8] * 2 + 6, 0, 12)     # away_xg_last5
    X[:, 9] = np.clip(X[:, 9] + 2, 0, 5)          # h2h_home_wins (0-5)
    X[:, 10] = np.clip(X[:, 10] + 1, 0, 3)        # h2h_draws
    X[:, 11] = np.clip(X[:, 11] + 1, 0, 5)        # h2h_away_wins
    X[:, 12] = np.clip(X[:, 12] * 10 + 55, 30, 75)  # home_possession_avg (30-75%)
    X[:, 13] = np.clip(X[:, 13] * 10 + 45, 25, 70)  # away_possession_avg
    X[:, 14] = 1  # venue_advantage (binary)
    X[:, 15] = np.clip(X[:, 15] + 5, 1, 10)       # stage_importance (1-10)
    X[:, 16] = np.clip(X[:, 16] + 3, 0, 7)        # home_rest_days (0-7)
    
    # Generate labels based on features (simulate realistic outcomes)
    elo_diff = X[:, 2]
    form_diff = X[:, 3] - X[:, 4]
    
    # Home win probability based on elo_diff and form
    home_prob = 1 / (1 + np.exp(-(elo_diff / 100 + form_diff / 2)))
    draw_prob = 0.25 + 0.05 * np.random.randn(n_samples)
    draw_prob = np.clip(draw_prob, 0.15, 0.35)
    
    # Normalize probabilities
    total = home_prob + draw_prob + (1 - home_prob)
    home_prob = home_prob / total
    draw_prob = draw_prob / total
    away_prob = 1 - home_prob - draw_prob
    
    # Generate outcome labels
    y_outcome = []
    for i in range(n_samples):
        rand = np.random.random()
        if rand < home_prob[i]:
            y_outcome.append(0)  # Home win
        elif rand < home_prob[i] + draw_prob[i]:
            y_outcome.append(1)  # Draw
        else:
            y_outcome.append(2)  # Away win
    
    y_outcome = np.array(y_outcome)
    
    # Generate xG labels
    y_xg_home = 1.5 + (X[:, 0] - X[:, 1]) / 200 + np.random.randn(n_samples) * 0.3
    y_xg_home = np.clip(y_xg_home, 0.3, 4.0)
    
    y_xg_away = 1.5 - (X[:, 0] - X[:, 1]) / 200 + np.random.randn(n_samples) * 0.3
    y_xg_away = np.clip(y_xg_away, 0.3, 4.0)
    
    return X, y_outcome, y_xg_home, y_xg_away


def train_match_outcome_model(
    n_samples: int = 1000,
    save_path: str = 'models/trained/match_outcome_model.pkl'
):
    """
    Train match outcome prediction model
    
    Args:
        n_samples: Number of training samples
        save_path: Path to save trained model
    """
    print("=" * 60)
    print("Training Match Outcome Predictor")
    print("=" * 60)
    
    # Generate training data
    print(f"\nGenerating {n_samples} training samples...")
    X, y_outcome, _, _ = generate_synthetic_training_data(n_samples)
    
    # Initialize and train model
    print("\nTraining XGBoost classifier...")
    predictor = MatchOutcomePredictor()
    metrics = predictor.train(X, y_outcome)
    
    # Print metrics
    print("\n📊 Training Metrics:")
    print(json.dumps(metrics, indent=2))
    
    # Save model
    print(f"\n💾 Saving model to {save_path}...")
    predictor.save_model(save_path)
    
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
    print("\n🎯 Sample Prediction:")
    print(json.dumps(result, indent=2))
    
    # Feature importance
    importance = predictor.get_feature_importance()
    print("\n📈 Top 5 Features:")
    sorted_importance = sorted(importance, key=lambda x: x['importance'], reverse=True)[:5]
    for item in sorted_importance:
        print(f"  {item['feature']:.<30} {item['importance']:.4f}")
    
    return predictor, metrics


def train_xg_models(
    n_samples: int = 1000,
    save_path_home: str = 'models/trained/xg_home_model.pkl',
    save_path_away: str = 'models/trained/xg_away_model.pkl'
):
    """
    Train expected goals prediction models
    
    Args:
        n_samples: Number of training samples
        save_path_home: Path to save home xG model
        save_path_away: Path to save away xG model
    """
    print("\n" + "=" * 60)
    print("Training Expected Goals Predictors")
    print("=" * 60)
    
    # Generate training data
    print(f"\nGenerating {n_samples} training samples...")
    X, _, y_xg_home, y_xg_away = generate_synthetic_training_data(n_samples)
    
    # Prepare xG-specific features (simplified for this example)
    X_xg = X[:, :10]  # Use first 10 features
    
    # Train home xG model
    print("\nTraining Home xG model...")
    xg_home = ExpectedGoalsPredictor()
    metrics_home = xg_home.train(X_xg, y_xg_home)
    print(f"  RMSE: {metrics_home['rmse']:.4f}")
    print(f"  MAE: {metrics_home['mae']:.4f}")
    print(f"  R²: {metrics_home['r2']:.4f}")
    xg_home.save_model(save_path_home)
    
    # Train away xG model
    print("\nTraining Away xG model...")
    xg_away = ExpectedGoalsPredictor()
    metrics_away = xg_away.train(X_xg, y_xg_away)
    print(f"  RMSE: {metrics_away['rmse']:.4f}")
    print(f"  MAE: {metrics_away['mae']:.4f}")
    print(f"  R²: {metrics_away['r2']:.4f}")
    xg_away.save_model(save_path_away)
    
    return xg_home, xg_away, metrics_home, metrics_away


def main():
    """Main training pipeline"""
    parser = argparse.ArgumentParser(description='Train UCL Prediction Models')
    parser.add_argument(
        '--model',
        type=str,
        default='all',
        choices=['match', 'xg', 'all'],
        help='Which model to train'
    )
    parser.add_argument(
        '--samples',
        type=int,
        default=1000,
        help='Number of training samples'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='models/trained',
        help='Output directory for trained models'
    )
    
    args = parser.parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    print("\n🚀 UCL ML Model Training Pipeline")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📦 Samples: {args.samples}")
    print(f"💾 Output: {args.output_dir}\n")
    
    results = {}
    
    # Train models based on selection
    if args.model in ['match', 'all']:
        match_model, match_metrics = train_match_outcome_model(
            n_samples=args.samples,
            save_path=os.path.join(args.output_dir, 'match_outcome_model.pkl')
        )
        results['match_outcome'] = match_metrics
    
    if args.model in ['xg', 'all']:
        xg_home, xg_away, metrics_home, metrics_away = train_xg_models(
            n_samples=args.samples,
            save_path_home=os.path.join(args.output_dir, 'xg_home_model.pkl'),
            save_path_away=os.path.join(args.output_dir, 'xg_away_model.pkl')
        )
        results['xg_home'] = metrics_home
        results['xg_away'] = metrics_away
    
    # Save training summary
    summary_path = os.path.join(args.output_dir, 'training_summary.json')
    summary = {
        'timestamp': datetime.now().isoformat(),
        'n_samples': args.samples,
        'models_trained': list(results.keys()),
        'metrics': results
    }
    
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ Training Complete!")
    print(f"📄 Summary saved to: {summary_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
