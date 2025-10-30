"""
Train Player Performance Prediction Models
Predicts individual player match statistics (goals, assists, shots, tackles, etc.)
Based on: player attributes, team strength, opponent, venue, recent form
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import json
from pathlib import Path
import sys

# Feature names for player prediction
FEATURE_NAMES = [
    # Player attributes (from SoFIFA)
    'overall_rating',
    'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
    
    # Position encoding
    'is_forward', 'is_midfielder', 'is_defender', 'is_goalkeeper',
    
    # Team context
    'team_elo',
    'team_form_points',
    'team_avg_goals_scored',
    'team_avg_goals_conceded',
    
    # Opposition context
    'opponent_elo',
    'opponent_def_rating',
    
    # Match context
    'is_home',
    'elo_differential',
    
    # Player recent form
    'player_goals_last_5',
    'player_assists_last_5',
    'player_minutes_last_5',
    'player_avg_rating_last_5',
]

# Target variables (position-specific)
FORWARD_TARGETS = ['goals', 'shots', 'assists', 'key_passes']
MIDFIELDER_TARGETS = ['assists', 'key_passes', 'goals', 'tackles', 'interceptions']
DEFENDER_TARGETS = ['tackles', 'interceptions', 'clearances', 'blocks']
GOALKEEPER_TARGETS = ['saves', 'goals_conceded', 'clean_sheet']


def generate_synthetic_training_data(n_samples=5000):
    """
    Generate synthetic player performance data for initial training
    Will be replaced with real historical data from API-Football
    """
    np.random.seed(42)
    
    data = []
    
    for _ in range(n_samples):
        # Player attributes (70-95 range for UCL quality)
        overall = np.random.randint(70, 96)
        pace = np.random.randint(60, 96)
        shooting = np.random.randint(60, 96)
        passing = np.random.randint(65, 95)
        dribbling = np.random.randint(60, 95)
        defending = np.random.randint(40, 90)
        physical = np.random.randint(55, 90)
        
        # Position (one-hot)
        position = np.random.choice(['FWD', 'MID', 'DEF', 'GK'], p=[0.3, 0.35, 0.3, 0.05])
        is_fwd = 1 if position == 'FWD' else 0
        is_mid = 1 if position == 'MID' else 0
        is_def = 1 if position == 'DEF' else 0
        is_gk = 1 if position == 'GK' else 0
        
        # Team context
        team_elo = np.random.randint(1600, 2100)
        team_form = np.random.randint(0, 16)  # Last 5 matches points
        team_goals_scored = np.random.uniform(1.5, 3.5)
        team_goals_conceded = np.random.uniform(0.5, 2.0)
        
        # Opponent context
        opponent_elo = np.random.randint(1600, 2100)
        opponent_def = np.random.randint(70, 90)
        
        # Match context
        is_home = np.random.choice([0, 1])
        elo_diff = team_elo - opponent_elo
        
        # Player recent form
        goals_last_5 = np.random.poisson(2 if is_fwd else (0.5 if is_mid else 0))
        assists_last_5 = np.random.poisson(1.5 if is_mid else (1 if is_fwd else 0))
        minutes_last_5 = np.random.randint(300, 451)
        avg_rating = np.random.uniform(6.0, 8.5)
        
        # Generate target values based on features
        if position == 'FWD':
            goals = np.random.poisson(
                max(0.01, (overall - 60) / 100 + (shooting / 300) + (team_elo - opponent_elo) / 2000 + is_home * 0.1)
            )
            shots = max(0, goals + np.random.poisson(2))
            assists = np.random.poisson((passing / 500) + (dribbling / 500))
            key_passes = max(0, assists + np.random.poisson(1))
            tackles = np.random.poisson(0.5)
            interceptions = np.random.poisson(0.3)
            clearances = 0
            blocks = 0
            saves = 0
            goals_conceded = 0
            clean_sheet = 0
            
        elif position == 'MID':
            goals = np.random.poisson((overall - 65) / 150 + (shooting / 400))
            shots = max(0, goals + np.random.poisson(1.5))
            assists = np.random.poisson((passing / 300) + (overall - 70) / 100)
            key_passes = max(0, assists + np.random.poisson(2))
            tackles = np.random.poisson((defending / 300) + 1)
            interceptions = np.random.poisson((defending / 400) + 0.5)
            clearances = np.random.poisson(0.5)
            blocks = 0
            saves = 0
            goals_conceded = 0
            clean_sheet = 0
            
        elif position == 'DEF':
            goals = np.random.poisson(0.05)
            shots = np.random.poisson(0.3)
            assists = np.random.poisson(0.1)
            key_passes = np.random.poisson(0.5)
            tackles = np.random.poisson((defending / 250) + 1.5)
            interceptions = np.random.poisson((defending / 300) + 1)
            clearances = np.random.poisson((defending / 200) + 2)
            blocks = np.random.poisson((defending / 400) + 0.5)
            saves = 0
            goals_conceded = 0
            clean_sheet = 0
            
        else:  # GK
            goals = 0
            shots = 0
            assists = 0
            key_passes = 0
            tackles = 0
            interceptions = 0
            clearances = 0
            blocks = 0
            saves = np.random.poisson(3 + (overall - 70) / 20)
            goals_conceded = np.random.poisson(max(0, 2 - (overall - 70) / 20 - (team_elo - opponent_elo) / 500))
            clean_sheet = 1 if goals_conceded == 0 else 0
        
        data.append({
            # Features
            'overall_rating': overall,
            'pace': pace,
            'shooting': shooting,
            'passing': passing,
            'dribbling': dribbling,
            'defending': defending,
            'physical': physical,
            'is_forward': is_fwd,
            'is_midfielder': is_mid,
            'is_defender': is_def,
            'is_goalkeeper': is_gk,
            'team_elo': team_elo,
            'team_form_points': team_form,
            'team_avg_goals_scored': team_goals_scored,
            'team_avg_goals_conceded': team_goals_conceded,
            'opponent_elo': opponent_elo,
            'opponent_def_rating': opponent_def,
            'is_home': is_home,
            'elo_differential': elo_diff,
            'player_goals_last_5': goals_last_5,
            'player_assists_last_5': assists_last_5,
            'player_minutes_last_5': minutes_last_5,
            'player_avg_rating_last_5': avg_rating,
            
            # Targets
            'goals': goals,
            'shots': shots,
            'assists': assists,
            'key_passes': key_passes,
            'tackles': tackles,
            'interceptions': interceptions,
            'clearances': clearances,
            'blocks': blocks,
            'saves': saves,
            'goals_conceded': goals_conceded,
            'clean_sheet': clean_sheet,
            'position': position,
        })
    
    return pd.DataFrame(data)


def train_player_model(X_train, y_train, X_test, y_test, target_name):
    """
    Train XGBoost regressor for a specific target stat
    """
    print(f"\n  📊 Training model for: {target_name}")
    
    # XGBoost hyperparameters optimized for player stats
    params = {
        'objective': 'reg:squarederror',
        'max_depth': 5,
        'learning_rate': 0.05,
        'n_estimators': 200,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'min_child_weight': 3,
        'gamma': 0.1,
        'reg_alpha': 0.05,
        'reg_lambda': 1.0,
        'random_state': 42,
    }
    
    model = xgb.XGBRegressor(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    # Evaluate
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)
    
    train_mae = mean_absolute_error(y_train, train_preds)
    test_mae = mean_absolute_error(y_test, test_preds)
    test_r2 = r2_score(y_test, test_preds)
    
    print(f"     Train MAE: {train_mae:.3f}")
    print(f"     Test MAE:  {test_mae:.3f}")
    print(f"     Test R²:   {test_r2:.3f}")
    
    return model, test_mae


def main():
    print("\n⚽ TRAINING PLAYER PERFORMANCE PREDICTION MODELS")
    print("=" * 70)
    
    # Generate training data
    print("\n📊 Generating synthetic training data...")
    df = generate_synthetic_training_data(n_samples=5000)
    print(f"   Generated {len(df)} training samples")
    print(f"   Position distribution:")
    print(df['position'].value_counts())
    
    # Prepare features
    X = df[FEATURE_NAMES]
    
    # Train models for each position and stat
    models = {}
    
    print("\n🎯 Training Forward Models (Goals, Shots, Assists, Key Passes)")
    fwd_data = df[df['is_forward'] == 1]
    X_fwd = fwd_data[FEATURE_NAMES]
    
    for target in FORWARD_TARGETS:
        y = fwd_data[target]
        X_train, X_test, y_train, y_test = train_test_split(X_fwd, y, test_size=0.2, random_state=42)
        model, mae = train_player_model(X_train, y_train, X_test, y_test, f"FWD_{target}")
        models[f'fwd_{target}'] = model
    
    print("\n🎯 Training Midfielder Models (Assists, Key Passes, Goals, Tackles)")
    mid_data = df[df['is_midfielder'] == 1]
    X_mid = mid_data[FEATURE_NAMES]
    
    for target in MIDFIELDER_TARGETS:
        y = mid_data[target]
        X_train, X_test, y_train, y_test = train_test_split(X_mid, y, test_size=0.2, random_state=42)
        model, mae = train_player_model(X_train, y_train, X_test, y_test, f"MID_{target}")
        models[f'mid_{target}'] = model
    
    print("\n🎯 Training Defender Models (Tackles, Interceptions, Clearances)")
    def_data = df[df['is_defender'] == 1]
    X_def = def_data[FEATURE_NAMES]
    
    for target in DEFENDER_TARGETS:
        y = def_data[target]
        X_train, X_test, y_train, y_test = train_test_split(X_def, y, test_size=0.2, random_state=42)
        model, mae = train_player_model(X_train, y_train, X_test, y_test, f"DEF_{target}")
        models[f'def_{target}'] = model
    
    print("\n🎯 Training Goalkeeper Models (Saves, Goals Conceded, Clean Sheet)")
    gk_data = df[df['is_goalkeeper'] == 1]
    if len(gk_data) > 50:
        X_gk = gk_data[FEATURE_NAMES]
        
        for target in GOALKEEPER_TARGETS:
            y = gk_data[target]
            X_train, X_test, y_train, y_test = train_test_split(X_gk, y, test_size=0.2, random_state=42)
            model, mae = train_player_model(X_train, y_train, X_test, y_test, f"GK_{target}")
            models[f'gk_{target}'] = model
    
    # Save models
    print("\n💾 Saving trained models...")
    model_dir = Path(__file__).parent / "models" / "trained"
    model_dir.mkdir(parents=True, exist_ok=True)
    
    for model_name, model in models.items():
        model_path = model_dir / f"player_{model_name}.json"
        model.save_model(str(model_path))
        print(f"   ✅ Saved: player_{model_name}.json")
    
    # Save feature names
    feature_config = {
        'feature_names': FEATURE_NAMES,
        'forward_targets': FORWARD_TARGETS,
        'midfielder_targets': MIDFIELDER_TARGETS,
        'defender_targets': DEFENDER_TARGETS,
        'goalkeeper_targets': GOALKEEPER_TARGETS,
    }
    
    config_path = model_dir / "player_features.json"
    with open(config_path, 'w') as f:
        json.dump(feature_config, f, indent=2)
    
    print(f"\n✅ Training Complete!")
    print(f"   Models saved to: {model_dir}")
    print(f"   Total models trained: {len(models)}")
    print("\n🎯 Next Steps:")
    print("   1. Integrate models into FastAPI server (ml/python/serve.py)")
    print("   2. Create /predict/player endpoint")
    print("   3. Test predictions with real player data")


if __name__ == "__main__":
    main()
