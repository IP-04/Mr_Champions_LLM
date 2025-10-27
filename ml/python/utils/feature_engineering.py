"""
Feature Engineering Utilities
Calculate ELO ratings, form metrics, and rolling statistics
"""

import numpy as np
from typing import List, Dict, Tuple
from collections import defaultdict

class ELOSystem:
    """
    ELO rating system for football teams
    Based on FiveThirtyEight's implementation
    """
    
    def __init__(self, k_factor: float = 20, initial_rating: float = 1500):
        """
        Initialize ELO system
        
        Args:
            k_factor: K-factor for rating changes
            initial_rating: Starting rating for new teams
        """
        self.k_factor = k_factor
        self.initial_rating = initial_rating
        self.ratings: Dict[str, float] = defaultdict(lambda: initial_rating)
    
    def expected_score(self, rating_a: float, rating_b: float) -> float:
        """
        Calculate expected score for team A
        
        Args:
            rating_a: ELO rating of team A
            rating_b: ELO rating of team B
        
        Returns:
            Expected score (0 to 1)
        """
        return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    
    def update_ratings(
        self,
        team_a: str,
        team_b: str,
        score_a: float,
        score_b: float,
        home_advantage: float = 100
    ) -> Tuple[float, float]:
        """
        Update ELO ratings after a match
        
        Args:
            team_a: Home team name
            team_b: Away team name
            score_a: Goals scored by team A
            score_b: Goals scored by team B
            home_advantage: ELO points for home advantage
        
        Returns:
            Tuple of (new_rating_a, new_rating_b)
        """
        # Get current ratings
        rating_a = self.ratings[team_a] + home_advantage
        rating_b = self.ratings[team_b]
        
        # Calculate expected scores
        expected_a = self.expected_score(rating_a, rating_b)
        expected_b = 1 - expected_a
        
        # Determine actual scores
        if score_a > score_b:
            actual_a, actual_b = 1.0, 0.0
        elif score_a < score_b:
            actual_a, actual_b = 0.0, 1.0
        else:
            actual_a, actual_b = 0.5, 0.5
        
        # Update ratings
        new_rating_a = self.ratings[team_a] + self.k_factor * (actual_a - expected_a)
        new_rating_b = self.ratings[team_b] + self.k_factor * (actual_b - expected_b)
        
        self.ratings[team_a] = new_rating_a
        self.ratings[team_b] = new_rating_b
        
        return new_rating_a, new_rating_b
    
    def get_rating(self, team: str) -> float:
        """Get current ELO rating for a team"""
        return self.ratings[team]
    
    def get_all_ratings(self) -> Dict[str, float]:
        """Get all team ratings"""
        return dict(self.ratings)


class FormCalculator:
    """
    Calculate team and player form metrics
    """
    
    @staticmethod
    def calculate_points_form(results: List[str], window: int = 5) -> float:
        """
        Calculate points-based form
        
        Args:
            results: List of results ('W', 'D', 'L')
            window: Number of recent matches
        
        Returns:
            Average points per game
        """
        recent = results[-window:]
        points = {'W': 3, 'D': 1, 'L': 0}
        total_points = sum(points.get(r, 0) for r in recent)
        return total_points / max(len(recent), 1)
    
    @staticmethod
    def calculate_goal_form(
        goals_scored: List[int],
        goals_conceded: List[int],
        window: int = 5
    ) -> Dict[str, float]:
        """
        Calculate goal-based form metrics
        
        Args:
            goals_scored: List of goals scored per match
            goals_conceded: List of goals conceded per match
            window: Number of recent matches
        
        Returns:
            Dict with avg_goals_scored, avg_goals_conceded, goal_difference
        """
        recent_scored = goals_scored[-window:]
        recent_conceded = goals_conceded[-window:]
        
        return {
            'avg_goals_scored': np.mean(recent_scored) if recent_scored else 0,
            'avg_goals_conceded': np.mean(recent_conceded) if recent_conceded else 0,
            'goal_difference': np.mean([s - c for s, c in zip(recent_scored, recent_conceded)])
        }
    
    @staticmethod
    def calculate_xg_form(
        xg: List[float],
        xga: List[float],
        window: int = 5
    ) -> Dict[str, float]:
        """
        Calculate expected goals form
        
        Args:
            xg: List of xG values
            xga: List of xG against values
            window: Number of recent matches
        
        Returns:
            Dict with avg_xg, avg_xga, xg_difference
        """
        recent_xg = xg[-window:]
        recent_xga = xga[-window:]
        
        return {
            'avg_xg': np.mean(recent_xg) if recent_xg else 0,
            'avg_xga': np.mean(recent_xga) if recent_xga else 0,
            'xg_difference': np.mean([x - xa for x, xa in zip(recent_xg, recent_xga)])
        }
    
    @staticmethod
    def calculate_form_trend(ratings: List[float]) -> float:
        """
        Calculate form trend using linear regression
        
        Args:
            ratings: List of match ratings
        
        Returns:
            Slope of trend line (positive = improving, negative = declining)
        """
        if len(ratings) < 2:
            return 0.0
        
        x = np.arange(len(ratings))
        y = np.array(ratings)
        
        # Simple linear regression
        slope = np.polyfit(x, y, 1)[0]
        return float(slope)


class RollingStatistics:
    """
    Calculate rolling window statistics
    """
    
    @staticmethod
    def rolling_mean(values: List[float], window: int) -> List[float]:
        """Calculate rolling mean"""
        if len(values) < window:
            return [np.mean(values)] * len(values)
        
        return [
            np.mean(values[max(0, i - window + 1):i + 1])
            for i in range(len(values))
        ]
    
    @staticmethod
    def rolling_std(values: List[float], window: int) -> List[float]:
        """Calculate rolling standard deviation"""
        if len(values) < window:
            return [np.std(values)] * len(values)
        
        return [
            np.std(values[max(0, i - window + 1):i + 1])
            for i in range(len(values))
        ]
    
    @staticmethod
    def rolling_sum(values: List[float], window: int) -> List[float]:
        """Calculate rolling sum"""
        if len(values) < window:
            return [np.sum(values)] * len(values)
        
        return [
            np.sum(values[max(0, i - window + 1):i + 1])
            for i in range(len(values))
        ]
    
    @staticmethod
    def exponential_moving_average(
        values: List[float],
        alpha: float = 0.3
    ) -> List[float]:
        """
        Calculate exponential moving average
        
        Args:
            values: List of values
            alpha: Smoothing factor (0 to 1)
        
        Returns:
            List of EMA values
        """
        if not values:
            return []
        
        ema = [values[0]]
        for val in values[1:]:
            ema.append(alpha * val + (1 - alpha) * ema[-1])
        
        return ema


def calculate_h2h_stats(
    team_a_results: List[Tuple[int, int]],
    team_b_results: List[Tuple[int, int]]
) -> Dict[str, int]:
    """
    Calculate head-to-head statistics
    
    Args:
        team_a_results: List of (goals_for, goals_against) for team A
        team_b_results: List of (goals_for, goals_against) for team B
    
    Returns:
        Dict with wins, draws, losses for team A
    """
    wins = 0
    draws = 0
    losses = 0
    
    for (a_for, a_against), (b_for, b_against) in zip(team_a_results, team_b_results):
        if a_for > a_against:
            wins += 1
        elif a_for < a_against:
            losses += 1
        else:
            draws += 1
    
    return {
        'wins': wins,
        'draws': draws,
        'losses': losses,
        'total_matches': len(team_a_results)
    }


def normalize_features(features: np.ndarray) -> np.ndarray:
    """
    Normalize features to [0, 1] range
    
    Args:
        features: Feature array (n_samples, n_features)
    
    Returns:
        Normalized features
    """
    min_vals = np.min(features, axis=0)
    max_vals = np.max(features, axis=0)
    
    # Avoid division by zero
    range_vals = max_vals - min_vals
    range_vals[range_vals == 0] = 1
    
    return (features - min_vals) / range_vals


# Export utilities
__all__ = [
    'ELOSystem',
    'FormCalculator',
    'RollingStatistics',
    'calculate_h2h_stats',
    'normalize_features'
]
