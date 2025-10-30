"""
Train ML Models on Real UCL Data
Uses data from exported CSV file
"""

import argparse
import numpy as np
import pandas as pd
import json
import os
from datetime import datetime

from models.match_predictor import MatchOutcomePredictor, ExpectedGoalsPredictor


def train_on_real_data(csv_path='data/real_training_data.csv', output_dir='models/trained'):
    """Train models using real data from CSV file"""
    print("\n🚀 TRAINING ON REAL UCL DATA")
    print("="*60)
    
    # Check if CSV file exists
    if not os.path.exists(csv_path):
        print(f"\n❌ CSV file not found: {csv_path}")
        print("   Run: npm run export-training-data")
        return False
    
    print(f"📂 Loading data from: {csv_path}")
    
    # Load CSV data
    df = pd.read_csv(csv_path)
    
    print(f"✅ Loaded {len(df)} training samples")
    
    if len(df) < 10:
        print("\n❌ Insufficient real data available")
        print("   Minimum 10 matches required for training")
        return False
    
    # Extract features (first 23 columns now - added 5 new features)
    feature_columns = [
        'home_elo', 'away_elo', 'elo_diff',
        'home_form_last5', 'away_form_last5',
        'home_goals_last5', 'away_goals_last5',
        'home_xg_last5', 'away_xg_last5',
        'h2h_home_wins', 'h2h_draws', 'h2h_away_wins',
        'home_possession_avg', 'away_possession_avg',
        'venue_advantage', 'stage_importance',
        'home_rest_days', 'away_rest_days',
        # New features to reduce home bias
        'elo_gap_magnitude', 'underdog_factor',
        'quality_tier_home', 'quality_tier_away',
        'strength_adjusted_venue'
    ]
    
    X = df[feature_columns].values
    y_outcome = df['outcome'].values
    y_xg_home = df['home_xg'].values
    y_xg_away = df['away_xg'].values
    
    print(f"\n📊 Training data shape:")
    print(f"   Features (X): {X.shape}")
    print(f"   Outcomes: {y_outcome.shape}")
    print(f"   xG values: {y_xg_home.shape}, {y_xg_away.shape}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Train match outcome model
    print("\n" + "="*60)
    print("📊 Training Match Outcome Predictor")
    print("="*60)
    
    outcome_model = MatchOutcomePredictor()
    metrics = outcome_model.train(X, y_outcome)
    
    print("\n📊 Training Metrics:")
    print(json.dumps(metrics, indent=2))
    
    outcome_model.save_model(os.path.join(output_dir, 'match_outcome_model.pkl'))
    
    # Train xG models
    print("\n" + "="*60)
    print("📊 Training Expected Goals Predictors")
    print("="*60)
    
    X_xg = X[:, :12]  # Use first 12 features for xG
    
    # Home xG
    print("\nTraining Home xG model...")
    xg_home = ExpectedGoalsPredictor()
    metrics_home = xg_home.train(X_xg, y_xg_home)
    print(f"  RMSE: {metrics_home['rmse']:.4f}")
    print(f"  MAE: {metrics_home['mae']:.4f}")
    print(f"  R²: {metrics_home['r2']:.4f}")
    xg_home.save_model(os.path.join(output_dir, 'xg_home_model.pkl'))
    
    # Away xG
    print("\nTraining Away xG model...")
    xg_away = ExpectedGoalsPredictor()
    metrics_away = xg_away.train(X_xg, y_xg_away)
    print(f"  RMSE: {metrics_away['rmse']:.4f}")
    print(f"  MAE: {metrics_away['mae']:.4f}")
    print(f"  R²: {metrics_away['r2']:.4f}")
    xg_away.save_model(os.path.join(output_dir, 'xg_away_model.pkl'))
    
    # Save training summary
    summary = {
        'timestamp': datetime.now().isoformat(),
        'data_source': 'real_csv_export',
        'csv_file': csv_path,
        'n_samples': len(X),
        'models_trained': ['match_outcome', 'xg_home', 'xg_away'],
        'metrics': {
            'match_outcome': metrics,
            'xg_home': metrics_home,
            'xg_away': metrics_away
        }
    }
    
    summary_path = os.path.join(output_dir, 'training_summary_real.json')
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "="*60)
    print("✅ ALL MODELS TRAINED ON REAL DATA!")
    print("="*60)
    print(f"\n📁 Models saved to: {output_dir}/")
    print(f"   - match_outcome_model.pkl")
    print(f"   - xg_home_model.pkl")
    print(f"   - xg_away_model.pkl")
    print(f"\n📄 Training summary: {summary_path}")
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Train UCL ML Models on Real Data from CSV'
    )
    
    parser.add_argument(
        '--csv',
        type=str,
        default='data/real_training_data.csv',
        help='Path to CSV file with training data'
    )
    
    parser.add_argument(
        '--output-dir',
        type=str,
        default='models/trained',
        help='Output directory for trained models'
    )
    
    args = parser.parse_args()
    
    print("\n⚽ UCL ML MODEL TRAINING - REAL DATA")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📂 CSV: {args.csv}")
    print(f"💾 Output: {args.output_dir}\n")
    
    success = train_on_real_data(csv_path=args.csv, output_dir=args.output_dir)
    
    if not success:
        print("\n⚠️  Training failed. Check CSV file and data availability.")
        return 1
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
