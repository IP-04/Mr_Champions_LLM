"""
Data Extraction from PostgreSQL Database
Extracts real UCL match data for ML training
"""

import os
import sys
import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../../.env')

class UCLDataExtractor:
    """Extract and prepare UCL match data for ML training"""
    
    def __init__(self):
        # Load .env from repository root (two directories up)
        env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
        load_dotenv(env_path)
        
        self.db_url = os.getenv('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL not found in environment variables")
        
        self.conn = None
        self.connect_db()
    
    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(self.db_url)
            print("✅ Connected to database")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)
    
    def fetch_matches(self) -> pd.DataFrame:
        """Fetch all matches from database"""
        query = """
        SELECT 
            id,
            "homeTeam",
            "awayTeam",
            date,
            status,
            "homeWinProb",
            "drawProb",
            "awayWinProb",
            "homeXg",
            "awayXg"
        FROM matches
        ORDER BY date
        """
        
        df = pd.read_sql(query, self.conn)
        print(f"📊 Fetched {len(df)} matches from database")
        return df
    
    def fetch_team_stats(self) -> pd.DataFrame:
        """Fetch team statistics"""
        query = """
        SELECT *
        FROM team_stats
        """
        
        try:
            df = pd.read_sql(query, self.conn)
            print(f"📊 Fetched team stats for {len(df)} teams")
            return df
        except Exception as e:
            print(f"⚠️  No team_stats table found: {e}")
            return pd.DataFrame()
    
    def fetch_player_stats(self) -> pd.DataFrame:
        """Fetch player statistics"""
        query = """
        SELECT *
        FROM players
        """
        
        df = pd.read_sql(query, self.conn)
        print(f"📊 Fetched {len(df)} players from database")
        return df
    
    def calculate_elo_ratings(self, matches_df: pd.DataFrame) -> Dict[str, float]:
        """
        Calculate ELO ratings for all teams based on match history
        
        Args:
            matches_df: DataFrame with match results
        
        Returns:
            Dictionary mapping team names to ELO ratings
        """
        from utils.feature_engineering import ELOSystem
        
        elo = ELOSystem(k_factor=20, initial_rating=1500)
        
        # Process matches chronologically
        for _, match in matches_df.iterrows():
            # Skip if match hasn't been played yet
            if match['status'] != 'FINISHED':
                continue
            
            home_team = match['homeTeam']
            away_team = match['awayTeam']
            
            # Infer result from probabilities (or use actual scores if available)
            home_prob = match.get('homeWinProb', 0)
            draw_prob = match.get('drawProb', 0)
            away_prob = match.get('awayWinProb', 0)
            
            # Determine winner based on probabilities
            if home_prob > away_prob and home_prob > draw_prob:
                home_score, away_score = 2, 1  # Home win
            elif away_prob > home_prob and away_prob > draw_prob:
                home_score, away_score = 1, 2  # Away win
            else:
                home_score, away_score = 1, 1  # Draw
            
            # Update ELO ratings
            elo.update_ratings(home_team, away_team, home_score, away_score)
        
        ratings = elo.get_all_ratings()
        print(f"📊 Calculated ELO for {len(ratings)} teams")
        return ratings
    
    def calculate_team_form(self, team: str, matches_df: pd.DataFrame, 
                           before_date: str, n_matches: int = 5) -> Dict:
        """
        Calculate team form metrics (last N matches before a specific date)
        
        Returns:
            Dict with form, goals_scored, xg, etc.
        """
        # Get team's recent matches
        team_matches = matches_df[
            ((matches_df['homeTeam'] == team) | (matches_df['awayTeam'] == team)) &
            (matches_df['date'] < before_date) &
            (matches_df['status'] == 'FINISHED')
        ].tail(n_matches)
        
        if len(team_matches) == 0:
            # No history, return defaults
            return {
                'form': 1.5,  # Average
                'goals': 5,
                'xg': 5.0,
                'possession': 50
            }
        
        # Calculate metrics
        form_points = []
        goals = 0
        xg = 0
        possession = []
        
        for _, match in team_matches.iterrows():
            is_home = match['homeTeam'] == team
            
            # Form (3 for win, 1 for draw, 0 for loss)
            if is_home:
                if match['homeWinProb'] > match['awayWinProb']:
                    form_points.append(3)
                elif match['homeWinProb'] < match['awayWinProb']:
                    form_points.append(0)
                else:
                    form_points.append(1)
                
                goals += match.get('homeXg', 1.5)  # Use xG as proxy for goals
                xg += match.get('homeXg', 1.5)
                possession.append(55)  # Default
            else:
                if match['awayWinProb'] > match['homeWinProb']:
                    form_points.append(3)
                elif match['awayWinProb'] < match['homeWinProb']:
                    form_points.append(0)
                else:
                    form_points.append(1)
                
                goals += match.get('awayXg', 1.5)
                xg += match.get('awayXg', 1.5)
                possession.append(45)  # Default
        
        return {
            'form': np.mean(form_points) if form_points else 1.5,
            'goals': int(goals),
            'xg': xg,
            'possession': np.mean(possession) if possession else 50
        }
    
    def calculate_h2h_stats(self, home_team: str, away_team: str, 
                           matches_df: pd.DataFrame, before_date: str) -> Dict:
        """Calculate head-to-head statistics"""
        h2h = matches_df[
            (((matches_df['homeTeam'] == home_team) & (matches_df['awayTeam'] == away_team)) |
             ((matches_df['homeTeam'] == away_team) & (matches_df['awayTeam'] == home_team))) &
            (matches_df['date'] < before_date) &
            (matches_df['status'] == 'FINISHED')
        ]
        
        if len(h2h) == 0:
            return {'home_wins': 0, 'draws': 0, 'away_wins': 0}
        
        home_wins = 0
        draws = 0
        away_wins = 0
        
        for _, match in h2h.iterrows():
            if match['homeTeam'] == home_team:
                if match['homeWinProb'] > match['awayWinProb']:
                    home_wins += 1
                elif match['homeWinProb'] < match['awayWinProb']:
                    away_wins += 1
                else:
                    draws += 1
            else:
                if match['awayWinProb'] > match['homeWinProb']:
                    home_wins += 1
                elif match['awayWinProb'] < match['homeWinProb']:
                    away_wins += 1
                else:
                    draws += 1
        
        return {
            'home_wins': home_wins,
            'draws': draws,
            'away_wins': away_wins
        }
    
    def prepare_training_data(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Prepare complete training dataset from database
        
        Returns:
            X: Feature matrix (n_samples, 18)
            y_outcome: Match outcomes (0=home, 1=draw, 2=away)
            y_xg_home: Home team xG
            y_xg_away: Away team xG
        """
        print("\n" + "="*60)
        print("🔄 EXTRACTING TRAINING DATA FROM DATABASE")
        print("="*60 + "\n")
        
        # Fetch data
        matches_df = self.fetch_matches()
        
        # Filter only finished matches
        finished_matches = matches_df[matches_df['status'] == 'FINISHED'].copy()
        
        if len(finished_matches) < 10:
            print(f"⚠️  Only {len(finished_matches)} finished matches found!")
            print("   Minimum 10 required for training. Using synthetic data as fallback.")
            return None, None, None, None
        
        print(f"✅ Found {len(finished_matches)} finished matches for training")
        
        # Calculate ELO ratings
        elo_ratings = self.calculate_elo_ratings(finished_matches)
        
        # Prepare features and labels
        X = []
        y_outcome = []
        y_xg_home = []
        y_xg_away = []
        
        print("\n🔧 Engineering features...")
        
        for idx, match in finished_matches.iterrows():
            home_team = match['homeTeam']
            away_team = match['awayTeam']
            match_date = match['date']
            
            # Get ELO ratings
            home_elo = elo_ratings.get(home_team, 1500)
            away_elo = elo_ratings.get(away_team, 1500)
            
            # Get form metrics
            home_form = self.calculate_team_form(home_team, finished_matches, match_date)
            away_form = self.calculate_team_form(away_team, finished_matches, match_date)
            
            # Get head-to-head
            h2h = self.calculate_h2h_stats(home_team, away_team, finished_matches, match_date)
            
            # Build feature vector (18 features)
            features = [
                home_elo,
                away_elo,
                home_elo - away_elo,  # elo_diff
                home_form['form'],
                away_form['form'],
                home_form['goals'],
                away_form['goals'],
                home_form['xg'],
                away_form['xg'],
                h2h['home_wins'],
                h2h['draws'],
                h2h['away_wins'],
                home_form['possession'],
                away_form['possession'],
                1,  # venue_advantage (always home)
                8,  # stage_importance (Champions League)
                4,  # home_rest_days (default)
                4   # away_rest_days (default)
            ]
            
            X.append(features)
            
            # Labels (outcome)
            home_prob = match['homeWinProb']
            draw_prob = match['drawProb']
            away_prob = match['awayWinProb']
            
            if home_prob > away_prob and home_prob > draw_prob:
                y_outcome.append(0)  # Home win
            elif away_prob > home_prob and away_prob > draw_prob:
                y_outcome.append(2)  # Away win
            else:
                y_outcome.append(1)  # Draw
            
            # Expected goals
            y_xg_home.append(match['homeXg'])
            y_xg_away.append(match['awayXg'])
        
        X = np.array(X, dtype=np.float32)
        y_outcome = np.array(y_outcome, dtype=np.int32)
        y_xg_home = np.array(y_xg_home, dtype=np.float32)
        y_xg_away = np.array(y_xg_away, dtype=np.float32)
        
        print(f"\n✅ Prepared training data:")
        print(f"   Samples: {len(X)}")
        print(f"   Features: {X.shape[1]}")
        print(f"   Outcome distribution:")
        print(f"     Home wins: {sum(y_outcome == 0)}")
        print(f"     Draws: {sum(y_outcome == 1)}")
        print(f"     Away wins: {sum(y_outcome == 2)}")
        
        return X, y_outcome, y_xg_home, y_xg_away
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("✅ Database connection closed")


def main():
    """Main function to extract and save training data"""
    extractor = UCLDataExtractor()
    
    try:
        # Extract training data
        X, y_outcome, y_xg_home, y_xg_away = extractor.prepare_training_data()
        
        if X is None:
            print("\n⚠️  Insufficient data, falling back to synthetic data")
            return False
        
        # Save to CSV for inspection
        import pandas as pd
        
        feature_names = [
            'home_elo', 'away_elo', 'elo_diff',
            'home_form_last5', 'away_form_last5',
            'home_goals_last5', 'away_goals_last5',
            'home_xg_last5', 'away_xg_last5',
            'h2h_home_wins', 'h2h_draws', 'h2h_away_wins',
            'home_possession_avg', 'away_possession_avg',
            'venue_advantage', 'stage_importance',
            'home_rest_days', 'away_rest_days'
        ]
        
        df = pd.DataFrame(X, columns=feature_names)
        df['outcome'] = y_outcome
        df['home_xg'] = y_xg_home
        df['away_xg'] = y_xg_away
        
        output_path = 'data/real_training_data.csv'
        os.makedirs('data', exist_ok=True)
        df.to_csv(output_path, index=False)
        
        print(f"\n💾 Training data saved to: {output_path}")
        print("\n✅ Data extraction complete!")
        
        return True
        
    finally:
        extractor.close()


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
